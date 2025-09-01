<?php
/**
 * Plugin Name: WP Cursor
 * Description: Safe WordPress control surface (diff/apply, WP-CLI proxy, audit). Premium feature set.
 * Version: 0.1.0
 * Author: Your Team
 */

defined('ABSPATH') || exit;

add_action('rest_api_init', function () {
    register_rest_route('wpcursor/v1', '/health', [
        'methods' => 'GET',
        'callback' => function () {
            return new WP_REST_Response(['ok' => true, 'version' => '0.1.0']);
        },
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('wpcursor/v1', '/files/diff', [
        'methods' => 'POST',
        'callback' => function (WP_REST_Request $req) {
            // TODO: validate paths under wp-content/**, compute diff diagnostics.
            return new WP_REST_Response(['ok' => false, 'error' => 'Not implemented'], 501);
        },
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);

    register_rest_route('wpcursor/v1', '/files/apply', [
        'methods' => 'POST',
        'callback' => function (WP_REST_Request $req) {
            // TODO: approval token, pre-backup, atomic write, smoke tests, rollback.
            return new WP_REST_Response(['ok' => false, 'error' => 'Not implemented'], 501);
        },
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);

    register_rest_route('wpcursor/v1', '/wpcli/run', [
        'methods' => 'POST',
        'callback' => function (WP_REST_Request $req) {
            // TODO: whitelist non-destructive commands; real execution via SSH in proxy service.
            return new WP_REST_Response(['ok' => false, 'error' => 'Not implemented'], 501);
        },
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);
});

