<?php
/*
Plugin Name: WP Cursor
Description: Minimal skeleton for WP Cursor REST API (Phase 1, read-only). Provides health, auth token stub, posts list, and logs tail (SSE) endpoints under /wp-json/wpcursor/v1.
Version: 0.1.0
Author: wpAgent
Requires PHP: 8.1
*/

if (!defined('ABSPATH')) { exit; }

class WPCursor_Plugin {
    const NS = 'wpcursor/v1';
    const JWT_ALG = 'HS256';
    const PROTOCOL_VERSION = '2024-11-05';
    const REST_SCHEMA_VERSION = '1.0.0';
    const TOOLS_VERSION = '0.1.0';
    const UPDATE_MANIFEST_URL = 'https://wpagent.app/updates.json';

    private function update_manifest_url() {
        if (defined('WPCURSOR_UPDATE_URL') && WPCURSOR_UPDATE_URL) {
            return (string) WPCURSOR_UPDATE_URL;
        }
        /**
         * Filter the update manifest URL used by WP Cursor.
         *
         * @param string $url
         */
        return apply_filters('wpcursor_update_manifest_url', self::UPDATE_MANIFEST_URL);
    }

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'register_admin_page']);
        add_filter('pre_set_site_transient_update_plugins', [$this, 'check_for_updates']);
        add_filter('plugins_api', [$this, 'plugins_api_info'], 10, 3);
    }

    private function base64url_encode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64url_decode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    private function jwt_secret() {
        if (defined('SECURE_AUTH_KEY') && SECURE_AUTH_KEY) return SECURE_AUTH_KEY;
        if (defined('AUTH_KEY') && AUTH_KEY) return AUTH_KEY;
        return wp_salt('auth');
    }

    private function audit_log_path() {
        $upload = wp_upload_dir();
        $dir = trailingslashit($upload['basedir']) . 'wpcursor';
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir . '/audit.log';
    }

    private function audit_append($event, array $data = []) {
        // Signed append-only log using HMAC chain
        $path = $this->audit_log_path();
        $secret = $this->jwt_secret();
        $entry = [
            'ts' => time(),
            'event' => (string)$event,
            'data' => $data,
            'user' => get_current_user_id(),
        ];
        $prevSig = '';
        if (file_exists($path)) {
            $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (is_array($lines) && !empty($lines)) {
                $last = json_decode($lines[count($lines)-1], true);
                if (is_array($last) && isset($last['sig'])) {
                    $prevSig = (string)$last['sig'];
                }
            }
        }
        $payload = wp_json_encode($entry);
        $sig = hash_hmac('sha256', $prevSig . '|' . $payload, $secret);
        $record = array_merge($entry, ['sig' => $sig, 'prev' => $prevSig]);
        file_put_contents($path, wp_json_encode($record) . "\n", FILE_APPEND | LOCK_EX);
    }

    private function get_refresh_tokens_meta_key() {
        return '_wpcursor_refresh_tokens';
    }

    private function load_refresh_tokens($user_id) {
        $tokens = get_user_meta($user_id, $this->get_refresh_tokens_meta_key(), true);
        if (!is_array($tokens)) $tokens = [];
        // prune expired
        $now = time();
        $changed = false;
        $kept = [];
        foreach ($tokens as $t) {
            $exp = isset($t['exp']) ? (int)$t['exp'] : 0;
            if ($exp > 0 && $exp < $now) { $changed = true; continue; }
            $kept[] = $t;
        }
        if ($changed) {
            update_user_meta($user_id, $this->get_refresh_tokens_meta_key(), $kept);
        }
        return $kept;
    }

    private function save_refresh_tokens($user_id, array $tokens) {
        update_user_meta($user_id, $this->get_refresh_tokens_meta_key(), $tokens);
    }

    private function create_refresh_token($user_id, array $scopes, $days = 30, $origin = '') {
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $now = time();
        $exp = $now + max(86400, (int)$days * 86400);
        $entry = [
            'hash' => $tokenHash,
            'scopes' => array_values(array_unique(array_map('strval', $scopes))),
            'origin' => (string)$origin,
            'iat' => $now,
            'exp' => $exp,
            'rot' => 0,
        ];
        $tokens = $this->load_refresh_tokens($user_id);
        $tokens[] = $entry;
        $this->save_refresh_tokens($user_id, $tokens);
        $this->audit_append('token.refresh.issue', [ 'user' => (int)$user_id, 'scopes' => $entry['scopes'], 'exp' => $exp, 'origin' => $origin ]);
        // Return the raw token to the caller once; do not persist raw token
        return array_merge($entry, [ 'token' => $token ]);
    }

    private function exchange_refresh_token($refresh_token, $origin = '') {
        $users = get_users([ 'meta_key' => $this->get_refresh_tokens_meta_key(), 'fields' => ['ID'] ]);
        foreach ($users as $u) {
            $uid = (int)$u->ID;
            $tokens = $this->load_refresh_tokens($uid);
            foreach ($tokens as $idx => $t) {
                $providedHash = hash('sha256', (string)$refresh_token);
                if (!hash_equals((string)($t['hash'] ?? ''), $providedHash)) continue;
                // origin strict-check: require equality when present
                if (!empty($t['origin']) && is_string($origin) && (string)$origin !== (string)$t['origin']) {
                    return new WP_Error('invalid_grant', 'Origin mismatch');
                }
                $now = time();
                $exp = isset($t['exp']) ? (int)$t['exp'] : 0;
                if ($exp > 0 && $exp <= $now) return new WP_Error('invalid_grant', 'Refresh token expired');
                $scopes = isset($t['scopes']) && is_array($t['scopes']) ? $t['scopes'] : ['posts:read'];
                // Issue short-lived access token (~15 min) and always rotate refresh (one-time use)
                $accessClaims = [
                    'sub' => $uid,
                    'scopes' => $scopes,
                    'site' => home_url(),
                ];
                if (!empty($t['origin'])) { $accessClaims['aud'] = (string)$t['origin']; }
                $access = $this->jwt_issue($accessClaims, 900);
                // Always rotate: revoke old and issue new
                $new = $this->create_refresh_token($uid, $scopes, 30, (string)($t['origin'] ?? ''));
                unset($tokens[$idx]);
                $this->save_refresh_tokens($uid, array_values($tokens));
                $this->audit_append('token.refresh.rotate', [ 'user' => $uid ]);
                return [ 'user_id' => $uid, 'access' => $access, 'refresh' => $new ];
            }
        }
        return new WP_Error('invalid_grant', 'Refresh token not found');
    }

    private function jwt_issue(array $claims, $ttl = 3600) {
        $header = ['alg' => self::JWT_ALG, 'typ' => 'JWT'];
        $now = time();
        $payload = array_merge([
            'iss' => home_url(),
            'iat' => $now,
            'exp' => $now + (int)$ttl,
        ], $claims);

        $segments = [
            $this->base64url_encode(wp_json_encode($header)),
            $this->base64url_encode(wp_json_encode($payload)),
        ];
        $signingInput = implode('.', $segments);
        $signature = hash_hmac('sha256', $signingInput, $this->jwt_secret(), true);
        $segments[] = $this->base64url_encode($signature);
        return implode('.', $segments);
    }

    private function jwt_verify($jwt) {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) return new WP_Error('invalid_token', 'Malformed JWT');
        list($h64, $p64, $s64) = $parts;
        $header = json_decode($this->base64url_decode($h64), true);
        $payload = json_decode($this->base64url_decode($p64), true);
        $sig = $this->base64url_decode($s64);
        if (!$header || !$payload) return new WP_Error('invalid_token', 'Invalid JWT JSON');
        if (($header['alg'] ?? '') !== self::JWT_ALG) return new WP_Error('invalid_token', 'Unsupported alg');
        $signingInput = $h64 . '.' . $p64;
        $expected = hash_hmac('sha256', $signingInput, $this->jwt_secret(), true);
        if (!hash_equals($expected, $sig)) return new WP_Error('invalid_token', 'Bad signature');
        if (isset($payload['exp']) && time() >= (int)$payload['exp']) return new WP_Error('invalid_token', 'Token expired');
        return $payload;
    }

    private function require_jwt_scope($request, $requiredScope) {
        $auth = $request->get_header('Authorization');
        if (!$auth || stripos($auth, 'Bearer ') !== 0) {
            return new WP_Error('unauthorized', 'Missing bearer token', ['status' => 401]);
        }
        $jwt = trim(substr($auth, 7));
        $payload = $this->jwt_verify($jwt);
        if (is_wp_error($payload)) return $payload;
        $scopes = isset($payload['scopes']) && is_array($payload['scopes']) ? $payload['scopes'] : [];
        if ($requiredScope && !in_array($requiredScope, $scopes, true)) {
            return new WP_Error('forbidden', 'Insufficient scope', ['status' => 403]);
        }
        return $payload;
    }

    private function plugin_version() {
        return '0.1.0';
    }

    private function tool_definitions() {
        return [
            [
                'name' => 'posts.list',
                'description' => 'List recent posts',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'status' => [ 'type' => 'string', 'description' => 'Post status (any|publish|draft)' ],
                        'perPage' => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 50 ],
                    ],
                ],
                'kind' => 'read',
                'version' => self::TOOLS_VERSION,
                'scope' => 'posts:read',
                'deprecated' => false,
            ],
            [
                'name' => 'posts.get',
                'description' => 'Get a post by ID',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [ 'id' => [ 'type' => 'integer' ] ],
                    'required' => ['id']
                ],
                'kind' => 'read',
                'version' => self::TOOLS_VERSION,
                'scope' => 'posts:read',
                'deprecated' => false,
            ],
            [
                'name' => 'files.read',
                'description' => 'Read a file under wp-content (relative path)',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [ 'path' => [ 'type' => 'string' ] ],
                    'required' => ['path']
                ],
                'kind' => 'read',
                'version' => self::TOOLS_VERSION,
                'scope' => 'files:read',
                'deprecated' => false,
            ],
            [
                'name' => 'logs.tail',
                'description' => 'Get logs tail stream (SSE URL)',
                'input_schema' => [ 'type' => 'object', 'properties' => [] ],
                'kind' => 'read',
                'version' => self::TOOLS_VERSION,
                'scope' => 'posts:read',
                'deprecated' => false,
            ],
        ];
    }

    private function tools_hash(array $tools = null) {
        if ($tools === null) $tools = $this->tool_definitions();
        return hash('sha256', wp_json_encode($tools));
    }

    private function health_payload() {
        $tools = $this->tool_definitions();
        $payload = [
            'ok' => true,
            'pluginVersion' => $this->plugin_version(),
            'protocolVersion' => self::PROTOCOL_VERSION,
            'schemaVersion' => self::REST_SCHEMA_VERSION,
            'wpVersion' => get_bloginfo('version'),
            'phpVersion' => PHP_VERSION,
            'capabilities' => [
                'tools' => $tools,
                'toolsHash' => $this->tools_hash($tools),
            ],
        ];

        $missing = [];
        foreach (['json', 'mbstring'] as $ext) {
            if (!extension_loaded($ext)) $missing[] = $ext;
        }
        $upload = wp_upload_dir();
        $writable = wp_is_writable($upload['basedir']);
        $debugLog = defined('WP_DEBUG_LOG') && WP_DEBUG_LOG ? WP_DEBUG_LOG : (WP_CONTENT_DIR . '/debug.log');
        $payload['environment'] = [
            'missingExtensions' => $missing,
            'uploadsWritable' => (bool)$writable,
            'debugLogPath' => $debugLog,
            'wpDebug' => defined('WP_DEBUG') ? (bool)WP_DEBUG : false,
        ];
        return $payload;
    }

    public function register_routes() {
        register_rest_route(self::NS, '/health', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'callback' => function() {
                $payload = $this->health_payload();
                $payload['timestamp'] = time();
                return new WP_REST_Response($payload, 200);
            }
        ]);

        // Token issuance + refresh
        register_rest_route(self::NS, '/auth/token', [
            'methods'  => 'POST',
            'permission_callback' => function () { return true; },
            'args' => [
                'code' => [ 'required' => false ],
                'scopes' => [ 'required' => false ],
                'ttl' => [ 'required' => false ],
                'grant_type' => [ 'required' => false ],
                'refresh_token' => [ 'required' => false ],
                'origin' => [ 'required' => false ],
            ],
            'callback' => function(WP_REST_Request $req) {
                $grant = (string)$req->get_param('grant_type');
                if ($grant === 'refresh_token') {
                    $refresh = (string)($req->get_param('refresh_token') ?: '');
                    $origin = (string)($req->get_param('origin') ?: '');
                    if ($refresh === '') return new WP_Error('invalid_request', 'Missing refresh_token', ['status' => 400]);
                    $ex = $this->exchange_refresh_token($refresh, $origin);
                    if (is_wp_error($ex)) return $ex;
                    $ttl = 900;
                    return new WP_REST_Response([
                        'access_token' => $ex['access'],
                        'token_type' => 'bearer',
                        'expires_in' => $ttl,
                        'refresh_token' => isset($ex['refresh']) ? $ex['refresh']['token'] : $refresh,
                    ], 200);
                }

                // Authenticated issuance for current user
                if (!current_user_can('read')) {
                    return new WP_Error('unauthorized', 'Login required', ['status' => 401]);
                }
                $user = wp_get_current_user();
                $scopes = $req->get_param('scopes');
                if (!is_array($scopes) || empty($scopes)) {
                    $scopes = ['posts:read'];
                }
                $ttl = (int)($req->get_param('ttl') ?: 900);
                $claims = [
                    'sub' => (int)$user->ID,
                    'scopes' => array_values(array_unique(array_map('strval', $scopes))),
                    'site' => home_url(),
                ];
                $origin = (string)($req->get_param('origin') ?: '');
                if (!empty($origin)) { $claims['aud'] = $origin; }
                $token = $this->jwt_issue($claims, $ttl);
                $refresh = $this->create_refresh_token((int)$user->ID, $claims['scopes'], 30, $origin);
                $this->audit_append('token.issue', [ 'scopes' => $claims['scopes'], 'ttl' => $ttl ]);
                return new WP_REST_Response([
                    'access_token' => $token,
                    'token_type' => 'bearer',
                    'expires_in' => $ttl,
                    'scopes' => $scopes,
                    'refresh_token' => $refresh['token'],
                    'refresh_expires_in' => (int)$refresh['exp'] - time(),
                ], 200);
            }
        ]);

        // Read-only: list recent posts (title, id, status)
        register_rest_route(self::NS, '/posts', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'args' => [
                'status' => [ 'required' => false, 'default' => 'any' ],
                'per_page' => [ 'required' => false, 'default' => 10 ],
            ],
            'callback' => function(WP_REST_Request $req) {
                $status = $req->get_param('status') ?: 'any';
                $per_page = (int)($req->get_param('per_page') ?: 10);
                $q = new WP_Query([
                    'post_type' => 'post',
                    'post_status' => $status,
                    'posts_per_page' => $per_page,
                    'no_found_rows' => true,
                    'fields' => 'ids',
                ]);
                $items = [];
                foreach ($q->posts as $pid) {
                    $items[] = [
                        'id' => $pid,
                        'title' => get_the_title($pid),
                        'status' => get_post_status($pid),
                        'link' => get_permalink($pid),
                    ];
                }
                return new WP_REST_Response(['items' => $items], 200);
            }
        ]);

        // Logs tail (SSE stub): emits keep-alive pings
        register_rest_route(self::NS, '/logs/tail', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'callback' => function() {
                if (!function_exists('header_remove')) {
                    // Old PHP fallback
                }
                header('Content-Type: text/event-stream');
                header('Cache-Control: no-cache');
                header('Connection: keep-alive');
                @ob_end_flush();
                @flush();
                $start = time();
                // Stream pings for up to 15 seconds as a stub
                while (time() - $start < 15) {
                    echo "event: ping\n";
                    echo 'data: {"ok":true,"ts":' . time() . "}\n\n";
                    @flush();
                    if (connection_aborted()) { break; }
                    usleep(1000000);
                }
                return null;
            }
        ]);

        // MCP endpoint (JSON-RPC over HTTP)
        register_rest_route('wp/v2', '/wpmcp/streamable', [
            'methods'  => 'POST',
            'permission_callback' => '__return_true',
            'callback' => function(WP_REST_Request $req) {
                $body = json_decode($req->get_body(), true);
                $id = $body['id'] ?? null;
                $method = $body['method'] ?? '';
                $params = $body['params'] ?? [];

                $respond = function($result = null, $error = null) use ($id) {
                    $resp = [ 'jsonrpc' => '2.0', 'id' => $id ];
                    if ($error) { $resp['error'] = $error; } else { $resp['result'] = $result; }
                    return new WP_REST_Response($resp, 200);
                };

                if ($method === 'initialize') {
                    $payload = $this->require_jwt_scope($req, 'posts:read');
                    if (is_wp_error($payload)) return $respond(null, [ 'code' => -32001, 'message' => $payload->get_error_message() ]);
                    $tools = $this->tool_definitions();
                    return $respond([
                        'serverInfo' => [ 'name' => 'wp-cursor', 'version' => $this->plugin_version() ],
                        'protocolVersion' => self::PROTOCOL_VERSION,
                        'schemaVersion' => self::REST_SCHEMA_VERSION,
                        'wpVersion' => get_bloginfo('version'),
                        'phpVersion' => PHP_VERSION,
                        'capabilities' => [
                            'tools' => $tools,
                            'toolsHash' => $this->tools_hash($tools),
                        ],
                    ]);
                }

                if ($method === 'tools/list/all') {
                    $payload = $this->require_jwt_scope($req, 'posts:read');
                    if (is_wp_error($payload)) return $respond(null, [ 'code' => -32001, 'message' => $payload->get_error_message() ]);
                    $tools = $this->tool_definitions();
                    return $respond(['tools' => $tools]);
                }

                if ($method === 'tools/call') {
                    $name = isset($params['name']) ? (string)$params['name'] : '';
                    $args = isset($params['arguments']) && is_array($params['arguments']) ? $params['arguments'] : [];

                    if ($name === 'posts.list') {
                        $payload = $this->require_jwt_scope($req, 'posts:read');
                        if (is_wp_error($payload)) return $respond(null, [ 'code' => -32001, 'message' => $payload->get_error_message() ]);
                        $status = isset($args['status']) ? (string)$args['status'] : 'any';
                        $per_page = isset($args['perPage']) ? (int)$args['perPage'] : 10;
                        $q = new WP_Query([
                            'post_type' => 'post',
                            'post_status' => $status,
                            'posts_per_page' => $per_page,
                            'no_found_rows' => true,
                            'fields' => 'ids',
                        ]);
                        $items = [];
                        foreach ($q->posts as $pid) {
                            $items[] = [
                                'id' => (int)$pid,
                                'title' => get_the_title($pid),
                                'status' => get_post_status($pid),
                                'link' => get_permalink($pid),
                            ];
                        }
                        $this->audit_append('tool.call', [ 'name' => 'posts.list', 'count' => count($items) ]);
                        return $respond(['items' => $items]);
                    }

                    if ($name === 'posts.get') {
                        $payload = $this->require_jwt_scope($req, 'posts:read');
                        if (is_wp_error($payload)) return $respond(null, [ 'code' => -32001, 'message' => $payload->get_error_message() ]);
                        $id = isset($args['id']) ? (int)$args['id'] : 0;
                        $p = $id ? get_post($id) : null;
                        if (!$p) return $respond(null, [ 'code' => -32602, 'message' => 'Post not found' ]);
                        $result = [
                            'id' => (int)$p->ID,
                            'title' => get_the_title($p),
                            'status' => get_post_status($p),
                            'content' => apply_filters('the_content', $p->post_content),
                            'link' => get_permalink($p),
                        ];
                        $this->audit_append('tool.call', [ 'name' => 'posts.get', 'id' => (int)$p->ID ]);
                        return $respond($result);
                    }

                    if ($name === 'files.read') {
                        $payload = $this->require_jwt_scope($req, 'files:read');
                        if (is_wp_error($payload)) return $respond(null, [ 'code' => -32001, 'message' => $payload->get_error_message() ]);
                        $rel = isset($args['path']) ? (string)$args['path'] : '';
                        $rel = ltrim($rel, '/');
                        if ($rel === '' || strpos($rel, "..") !== false) {
                            return $respond(null, [ 'code' => -32602, 'message' => 'Invalid path' ]);
                        }
                        $base = realpath(WP_CONTENT_DIR);
                        $full = $base . DIRECTORY_SEPARATOR . $rel;
                        $real = realpath($full);
                        if ($real === false || strpos($real, $base) !== 0 || !is_file($real)) {
                            return $respond(null, [ 'code' => -32602, 'message' => 'File not found or outside scope' ]);
                        }
                        $max = 1024 * 1024; // 1MB
                        $size = filesize($real);
                        if ($size === false) { $size = 0; }
                        $truncated = false;
                        if ($size > $max) { $truncated = true; }
                        $content = file_get_contents($real, false, null, 0, $max);
                        $this->audit_append('tool.call', [ 'name' => 'files.read', 'path' => $rel, 'size' => (int)$size, 'truncated' => $truncated ]);
                        return $respond([
                            'path' => $rel,
                            'size' => (int)$size,
                            'truncated' => $truncated,
                            'content' => $content,
                        ]);
                    }

                    if ($name === 'logs.tail') {
                        $payload = $this->require_jwt_scope($req, 'posts:read');
                        if (is_wp_error($payload)) return $respond(null, [ 'code' => -32001, 'message' => $payload->get_error_message() ]);
                        $url = rest_url(self::NS . '/logs/tail');
                        $this->audit_append('tool.call', [ 'name' => 'logs.tail' ]);
                        return $respond([ 'stream' => 'sse', 'url' => $url ]);
                    }

                    return $respond(null, [ 'code' => -32601, 'message' => 'Unknown tool' ]);
                }

                return $respond(null, [ 'code' => -32600, 'message' => 'Unsupported method' ]);
            }
        ]);

        // Admin: remote update endpoint (optional, disabled by default)
        register_rest_route(self::NS, '/admin/update', [
            'methods'  => 'POST',
            'permission_callback' => function () { return current_user_can('manage_options'); },
            'args' => [
                'url' => [ 'required' => true ],
                'checksum' => [ 'required' => true ],
                'nonce' => [ 'required' => false ],
            ],
            'callback' => function(WP_REST_Request $req) {
                $payload = $this->require_jwt_scope($req, 'admin:update');
                if (is_wp_error($payload)) return new WP_Error('forbidden', 'Insufficient scope', ['status' => 403]);
                if (!defined('WPCURSOR_REMOTE_UPDATE') || !WPCURSOR_REMOTE_UPDATE) {
                    return new WP_REST_Response([
                        'ok' => false,
                        'message' => 'Remote update disabled',
                    ], 400);
                }
                return new WP_REST_Response([
                    'ok' => false,
                    'message' => 'Not implemented in skeleton',
                ], 501);
            }
        ]);
    }

    public function register_admin_page() {
        add_menu_page(
            'WP Cursor',
            'WP Cursor',
            'manage_options',
            'wpcursor-admin',
            [$this, 'render_admin_page'],
            'dashicons-admin-tools',
            80
        );
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) return;
        $issued = null;
        $redirected = false;
        // Auto-connect flow via GET: /wp-admin/admin.php?page=wpcursor-admin&connect=1&app=...&write=1
        if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['connect']) && isset($_GET['app'])) {
            $app_url = esc_url_raw(trim((string)$_GET['app']));
            if (!empty($app_url)) {
                $scopes = ['posts:read'];
                if (isset($_GET['files']) && $_GET['files'] === '1') { $scopes[] = 'files:read'; }
                $ttl = isset($_GET['ttl']) ? max(300, min(24*3600, (int)$_GET['ttl'])) : 3600;
                $claims = [
                    'sub' => get_current_user_id(),
                    'scopes' => $scopes,
                    'site' => home_url(),
                ];
                $token = $this->jwt_issue($claims, $ttl);
                $refresh = $this->create_refresh_token(get_current_user_id(), $scopes, 30, $app_url);
                $this->audit_append('token.issue', [ 'scopes' => $scopes, 'ttl' => $ttl, 'via' => 'auto-connect' ]);
                $accept = rtrim($app_url, '/') . '/api/mcp/connection/accept';
                $params = [
                    'site' => home_url(),
                    'token' => $token,
                    'refresh' => $refresh['token'],
                    'write' => isset($_GET['write']) && ($_GET['write'] === '1' || $_GET['write'] === 'true') ? '1' : '0',
                ];
                $location = $accept . '?' . http_build_query($params);
                $redirected = true;
                wp_safe_redirect($location);
                exit;
            }
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer('wpcursor_issue_token')) {
            $scopes = isset($_POST['scopes']) && is_array($_POST['scopes']) ? array_values(array_map('sanitize_text_field', $_POST['scopes'])) : ['posts:read'];
            $ttl = isset($_POST['ttl']) ? max(60, min(24*3600, (int)$_POST['ttl'])) : 3600;
            $claims = [
                'sub' => get_current_user_id(),
                'scopes' => $scopes,
                'site' => home_url(),
            ];
            $token = $this->jwt_issue($claims, $ttl);
            $this->audit_append('token.issue', [ 'scopes' => $scopes, 'ttl' => $ttl, 'via' => 'admin' ]);
            $issued = [ 'token' => $token, 'ttl' => $ttl, 'scopes' => $scopes ];
        }

        // Optional connect-to-app flow
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['connect_app']) && check_admin_referer('wpcursor_connect_app')) {
            $app_url = isset($_POST['app_url']) ? esc_url_raw(trim((string)$_POST['app_url'])) : '';
            if (!empty($app_url)) {
                $scopes = isset($_POST['scopes']) && is_array($_POST['scopes']) ? array_values(array_map('sanitize_text_field', $_POST['scopes'])) : ['posts:read'];
                $ttl = isset($_POST['ttl']) ? max(60, min(24*3600, (int)$_POST['ttl'])) : 3600;
                $claims = [
                    'sub' => get_current_user_id(),
                    'scopes' => $scopes,
                    'site' => home_url(),
                ];
                $token = $this->jwt_issue($claims, $ttl);
                $refresh = $this->create_refresh_token(get_current_user_id(), $scopes, 30, $app_url);
                $this->audit_append('token.issue', [ 'scopes' => $scopes, 'ttl' => $ttl, 'via' => 'connect' ]);
                $accept = rtrim($app_url, '/') . '/api/mcp/connection/accept';
                $params = [
                    'site' => home_url(),
                    'token' => $token,
                    'refresh' => $refresh['token'],
                    'write' => isset($_POST['write_mode']) ? '1' : '0',
                ];
                $location = $accept . '?' . http_build_query($params);
                $redirected = true;
                wp_safe_redirect($location);
                exit;
            }
        }

        $audit_path = esc_html($this->audit_log_path());
        $audit_lines = @file($this->audit_log_path(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($audit_lines)) { $audit_lines = []; }
        $recent = array_slice($audit_lines, -20);
        ?>
        <div class="wrap">
            <h1>WP Cursor (Read-only v0.1)</h1>
            <p>Generate scoped, short-lived tokens for MCP access. Do not share tokens. Rotate regularly.</p>
            <?php if ($issued): ?>
                <div class="notice notice-success"><p><strong>Token issued.</strong> Expires in <?php echo (int)$issued['ttl']; ?> seconds.</p></div>
                <textarea readonly rows="3" style="width:100%"><?php echo esc_textarea($issued['token']); ?></textarea>
            <?php endif; ?>
            <form method="post">
                <?php wp_nonce_field('wpcursor_issue_token'); ?>
                <h2>Issue Token</h2>
                <p>
                    <label><input type="checkbox" name="scopes[]" value="posts:read" checked> posts:read</label>
                    <label><input type="checkbox" name="scopes[]" value="files:read"> files:read</label>
                </p>
                <p>
                    <label>TTL (seconds): <input type="number" name="ttl" min="60" max="86400" value="3600"></label>
                </p>
                <p><button type="submit" class="button button-primary">Generate Token</button></p>
            </form>

            <hr style="margin:1.5em 0;" />

            <h2>Connect to App</h2>
            <p>Connect without manually entering Site URL or JWT in the app. This will issue a token pair (access + refresh) and redirect back to the app.</p>
            <form method="post">
                <?php wp_nonce_field('wpcursor_connect_app'); ?>
                <input type="hidden" name="connect_app" value="1" />
                <p>
                    <label>App URL:
                        <input type="url" name="app_url" style="width: 420px;" placeholder="https://app.example.com or http://localhost:3000" value="<?php echo esc_attr(defined('WPCURSOR_APP_URL') && WPCURSOR_APP_URL ? (string)WPCURSOR_APP_URL : (isset($_GET['app']) ? (string)$_GET['app'] : (is_ssl() ? 'https://localhost:3000' : 'http://localhost:3000'))); ?>" required />
                    </label>
                </p>
                <p>
                    <label><input type="checkbox" name="scopes[]" value="posts:read" checked> posts:read</label>
                    <label><input type="checkbox" name="scopes[]" value="files:read"> files:read</label>
                    <label style="margin-left:1em;"><input type="checkbox" name="write_mode" value="1"> Enable write mode</label>
                </p>
                <p>
                    <label>TTL (seconds): <input type="number" name="ttl" min="60" max="86400" value="3600"></label>
                </p>
                <p><button type="submit" class="button">Connect to App</button></p>
            </form>

            <p style="margin-top:0.5em">
                Tip: set <code>define('WPCURSOR_APP_URL','https://app.example.com');</code> in <code>wp-config.php</code> to prefill the App URL and enable one-click auto-connect via <code>?page=wpcursor-admin&connect=1&app=...</code>.
            </p>

            <h2>Recent Audit Log</h2>
            <p>Path: <code><?php echo $audit_path; ?></code></p>
            <textarea readonly rows="10" style="width:100%">
<?php foreach ($recent as $line) { echo esc_textarea($line) . "\n"; } ?>
            </textarea>
        </div>
        <?php
    }

    // Update checker hooking into WordPress updates (reads manifest JSON)
    public function check_for_updates($transient) {
        if (empty($transient) || !is_object($transient)) return $transient;
        $plugin_file = plugin_basename(__FILE__);
        $current = $this->plugin_version();
        $res = wp_remote_get($this->update_manifest_url(), [ 'timeout' => 5 ]);
        if (is_wp_error($res)) return $transient;
        $code = wp_remote_retrieve_response_code($res);
        if ($code !== 200) return $transient;
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if (!is_array($body) || empty($body['version'])) return $transient;
        $latest = $body['version'];
        if (version_compare($latest, $current, '>')) {
            $obj = new stdClass();
            $obj->slug = 'wp-cursor';
            $obj->new_version = $latest;
            $obj->url = isset($body['url']) ? $body['url'] : '';
            $obj->package = isset($body['downloadUrl']) ? $body['downloadUrl'] : '';
            $obj->tested = isset($body['tested']) ? $body['tested'] : '';
            $obj->requires = isset($body['requires']) ? $body['requires'] : '';
            $transient->response[$plugin_file] = $obj;
        }
        return $transient;
    }

    public function plugins_api_info($result, $action, $args) {
        if ($action !== 'plugin_information' || !isset($args->slug) || $args->slug !== 'wp-cursor') {
            return $result;
        }
        $res = wp_remote_get($this->update_manifest_url(), [ 'timeout' => 5 ]);
        if (is_wp_error($res)) return $result;
        $code = wp_remote_retrieve_response_code($res);
        if ($code !== 200) return $result;
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if (!is_array($body)) return $result;
        $info = new stdClass();
        $info->name = 'WP Cursor';
        $info->slug = 'wp-cursor';
        $info->version = isset($body['version']) ? $body['version'] : $this->plugin_version();
        $info->download_link = isset($body['downloadUrl']) ? $body['downloadUrl'] : '';
        $info->sections = [ 'changelog' => isset($body['changelog']) ? $body['changelog'] : '' ];
        return $info;
    }
}

new WPCursor_Plugin();
