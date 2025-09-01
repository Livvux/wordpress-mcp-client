import { isDevelopmentEnvironment, isTestEnvironment } from './constants';

/**
 * Basic same-origin/allowlist check for state-changing requests.
 * - Allows missing Origin (e.g., server-to-server)
 * - Allows same-origin
 * - Allows any explicitly allowed origins via ALLOWED_ORIGINS (comma-separated)
 * - In test env, always allow
 */
export function isAllowedOrigin(request: Request): boolean {
  if (isTestEnvironment) return true;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    const requestUrl = new URL(request.url);
    const sameOrigin = origin === `${requestUrl.protocol}//${requestUrl.host}`;
    if (sameOrigin) return true;

    const allowlist = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    return allowlist.includes(origin.toLowerCase());
  } catch {
    // On parsing failure, be conservative in production
    return isDevelopmentEnvironment;
  }
}
