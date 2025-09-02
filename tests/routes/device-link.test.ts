import { expect, test } from '../fixtures';

test.describe
  .serial('Device link API', () => {
    test('happy path: start → activate → poll', async ({ adaContext }) => {
      // Start device flow
      const startRes = await test.request.post(
        '/api/mcp/connection/device/start',
        { data: {} },
      );
      expect(startRes.status()).toBe(200);
      const startBody = await startRes.json();
      expect(startBody).toHaveProperty('device_code');
      expect(startBody).toHaveProperty('user_code');
      const deviceCode: string = String(startBody.device_code);
      const userCode: string = String(startBody.user_code);

      // Poll before activation → pending
      const pendingRes = await test.request.post(
        '/api/mcp/connection/device/poll',
        { data: { device_code: deviceCode } },
      );
      expect(pendingRes.status()).toBe(200);
      const pendingBody = await pendingRes.json();
      expect(pendingBody.status).toBe('pending');

      // Activate from plugin/server side
      const activateRes = await test.request.post(
        '/api/mcp/connection/device/activate',
        {
          data: {
            user_code: userCode,
            site: 'https://example.com',
            token: 'jwt-token',
            write: true,
            pluginVersion: '0.1.0',
          },
        },
      );
      expect(activateRes.status()).toBe(200);
      const activateBody = await activateRes.json();
      expect(activateBody.ok).toBeTruthy();

      // Poll unauthenticated → requires login
      const requireLoginRes = await test.request.post(
        '/api/mcp/connection/device/poll',
        { data: { device_code: deviceCode } },
      );
      expect(requireLoginRes.status()).toBe(200);
      const requireLoginBody = await requireLoginRes.json();
      expect(requireLoginBody.status).toBe('approved_requires_login');

      // Poll authenticated → approved
      const approvedRes = await adaContext.request.post(
        '/api/mcp/connection/device/poll',
        { data: { device_code: deviceCode } },
      );
      expect(approvedRes.status()).toBe(200);
      const approvedBody = await approvedRes.json();
      expect(approvedBody.status).toBe('approved');
      expect(approvedBody.siteUrl).toBe('https://example.com');
      expect(approvedBody.writeMode).toBe(true);
    });

    test('error cases: invalid device_code and invalid user_code', async () => {
      // Invalid device code → 400
      const badPoll = await test.request.post(
        '/api/mcp/connection/device/poll',
        { data: { device_code: 'deadbeefdeadbeefdeadbeefdeadbeef' } },
      );
      expect(badPoll.status()).toBe(400);
      const badPollBody = await badPoll.json();
      expect(badPollBody.error).toBe('invalid_device_code');

      // Invalid user code → 400
      const badActivate = await test.request.post(
        '/api/mcp/connection/device/activate',
        {
          data: {
            user_code: 'ZZZINVALID',
            site: 'https://example.com',
            token: 'jwt-token',
            write: false,
          },
        },
      );
      expect(badActivate.status()).toBe(400);
    });

    test('rate limit on start per IP', async () => {
      const headers = { 'x-forwarded-for': '198.51.100.23' } as any;
      // Our limit is 10/min; send 11th and expect 429
      for (let i = 0; i < 10; i++) {
        const res = await test.request.post(
          '/api/mcp/connection/device/start',
          { data: {}, headers },
        );
        expect(res.status()).toBe(200);
      }
      const blocked = await test.request.post(
        '/api/mcp/connection/device/start',
        { data: {}, headers },
      );
      expect(blocked.status()).toBe(429);
    });
  });
