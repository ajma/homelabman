import { expect, test } from '@playwright/test';

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

test('redirects to login when user is unauthenticated', async ({ page }) => {
  await page.route('**/api/auth/status', async (route) => {
    await route.fulfill(jsonResponse({ authenticated: false, needsOnboarding: false }));
  });

  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Sign in to manage your homelab')).toBeVisible();
});

test('redirects to onboarding when instance still needs onboarding', async ({ page }) => {
  await page.route('**/api/auth/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false, needsOnboarding: true }),
    });
  });

  await page.goto('/');

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Let's get your instance set up.")).toBeVisible();
});

test('shows dashboard when authenticated', async ({ page }) => {
  await page.route('**/api/auth/status', async (route) => {
    await route.fulfill(jsonResponse({ authenticated: true, needsOnboarding: false }));
  });

  await page.route('**/api/projects', async (route) => {
    await route.fulfill(jsonResponse([]));
  });

  await page.goto('/');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('No projects yet. Create your first project to get started.')).toBeVisible();
});

test('shows validation messages when login is submitted with empty fields', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText('String must contain at least 3 character(s)')).toBeVisible();
  await expect(page.getByText('String must contain at least 8 character(s)')).toBeVisible();
});

test('shows API error toast when login credentials are rejected', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill(jsonResponse({ error: 'Invalid credentials' }, 401));
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('demo-user');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText('Invalid credentials')).toBeVisible();
});

test('completes onboarding with Cloudflare provider and lands on dashboard', async ({ page }) => {
  let onboardingComplete = false;
  let onboardingPayload: unknown;

  await page.route('**/api/auth/status', async (route) => {
    await route.fulfill(jsonResponse(
      onboardingComplete
        ? { authenticated: true, needsOnboarding: false }
        : { authenticated: false, needsOnboarding: true },
    ));
  });

  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill(jsonResponse({ id: 'user-1' }, 201));
  });

  await page.route('**/api/cloudflare/accounts', async (route) => {
    await route.fulfill(jsonResponse([{ id: 'acc-1', name: 'My Account' }]));
  });

  await page.route('**/api/cloudflare/tunnels', async (route) => {
    await route.fulfill(jsonResponse([]));
  });

  await page.route('**/api/cloudflare/tunnels/create', async (route) => {
    await route.fulfill(jsonResponse({ tunnelId: 'tunnel-abc', tunnelToken: 'tok-xyz' }));
  });

  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill(jsonResponse({ id: 'proj-1' }, 201));
    } else {
      await route.fulfill(jsonResponse([]));
    }
  });

  await page.route('**/api/settings/onboarding', async (route) => {
    onboardingPayload = route.request().postDataJSON();
    onboardingComplete = true;
    await route.fulfill(jsonResponse({ ok: true }));
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 1: Create account
  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Step 2: Configure Cloudflare provider
  await expect(page.getByRole('heading', { name: 'Configure Exposure Providers' })).toBeVisible();
  await page.getByRole('button', { name: 'Configure' }).last().click();

  await page.getByLabel('API Token').fill('cf-token-123');
  await page.getByRole('button', { name: 'Connect' }).click();

  // Single account is auto-selected; tunnel dropdown appears (no existing tunnels)
  await expect(page.locator('#cf-tunnel')).toBeVisible();
  await page.getByLabel(/Tunnel Name/).fill('homelab-tunnel');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: Complete — summary reflects configured Cloudflare provider
  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  await expect(page.getByText('Exposure providers configured: Cloudflare')).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByText('Setup complete! Welcome to HomelabMan.')).toBeVisible();
  expect(onboardingPayload).toEqual({
    exposureProviders: [
      {
        providerType: 'cloudflare',
        name: 'Cloudflare',
        enabled: true,
        configuration: {
          apiToken: 'cf-token-123',
          accountId: 'acc-1',
          tunnelId: 'tunnel-abc',
        },
      },
    ],
  });

  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('completes onboarding happy path and lands on dashboard', async ({ page }) => {
  let onboardingComplete = false;
  let onboardingPayload: unknown;

  await page.route('**/api/auth/status', async (route) => {
    if (onboardingComplete) {
      await route.fulfill(jsonResponse({ authenticated: true, needsOnboarding: false }));
      return;
    }

    await route.fulfill(jsonResponse({ authenticated: false, needsOnboarding: true }));
  });

  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill(jsonResponse({ id: 'user-1' }, 201));
  });

  await page.route('**/api/settings/onboarding', async (route) => {
    onboardingPayload = route.request().postDataJSON();
    onboardingComplete = true;
    await route.fulfill(jsonResponse({ ok: true }));
  });

  await page.route('**/api/projects', async (route) => {
    await route.fulfill(jsonResponse([]));
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('heading', { name: 'Configure Exposure Providers' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByText('Setup complete! Welcome to HomelabMan.')).toBeVisible();
  expect(onboardingPayload).toEqual({ exposureProviders: [] });

  // Re-enter protected route after onboarding API completion to validate authenticated state.
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});