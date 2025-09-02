import { expect, test } from '../fixtures';

test.describe('Device pairing UI', () => {
  test('User can pair via device code from settings modal', async ({
    adaContext,
  }) => {
    const { page, request } = adaContext;

    // Open chat homepage
    await page.goto('/');

    // Open WordPress settings modal
    await page.getByTestId('wordpress-settings-button').click();

    // Switch to Plugin Connection mode so device pairing is visible
    await page.getByRole('button', { name: 'Plugin Connection' }).click();

    // Start device pairing
    await page.getByTestId('device-get-code').click();

    // Read the generated user code
    const codeEl = page.getByTestId('device-user-code');
    await expect(codeEl).toBeVisible();
    const userCode = (await codeEl.textContent())?.trim() || '';
    expect(userCode.length).toBeGreaterThanOrEqual(4);

    // Activate using plugin-like request
    const activateRes = await request.post(
      '/api/mcp/connection/device/activate',
      {
        data: {
          user_code: userCode,
          site: 'https://ui-test.example',
          token: 'jwt-token',
          write: true,
          pluginVersion: '0.1.0',
        },
      },
    );
    expect(activateRes.status()).toBe(200);

    // Wait for success alert in UI
    await expect(page.getByText('Paired successfully')).toBeVisible();

    // WordPress connection component should reflect connected state (Disconnect button visible)
    await expect(
      page.getByRole('button', { name: 'Disconnect' }),
    ).toBeVisible();
  });
});
