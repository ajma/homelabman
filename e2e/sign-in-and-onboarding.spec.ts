import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/test/reset');
});

test('redirects to login when user is unauthenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Sign in to manage your homelab')).toBeVisible();
});

test('redirects to onboarding when instance still needs onboarding', async ({ page }) => {
  await page.request.post('/api/test/reset?seed=false');
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Let's get your instance set up.")).toBeVisible();
});

test('shows dashboard when authenticated', async ({ page }) => {
  await page.goto('/api/test/session');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Nothing deployed yet')).toBeVisible();
});

test('shows validation messages when login is submitted with empty fields', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('String must contain at least 3 character(s)')).toBeVisible();
  await expect(page.getByText('String must contain at least 8 character(s)')).toBeVisible();
});

test('shows API error toast when login credentials are rejected', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password').fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('Invalid username or password')).toBeVisible();
});

test('completes onboarding with Cloudflare provider and lands on dashboard', async ({ page }) => {
  await page.request.post('/api/test/reset?seed=false');
  await page.request.post('/api/test/mock/cloudflare', {
    data: {
      accounts: [{ id: 'acc-1', name: 'My Account' }],
      tunnels: [],
      nextTunnel: { tunnelId: 'tunnel-abc', tunnelToken: 'tok-xyz' },
    },
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 1: Create account
  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Step 2: Configure Cloudflare provider
  await expect(page.getByRole('heading', { name: 'Configure Exposure Providers' })).toBeVisible();
  await page.getByRole('button', { name: 'Configure' }).last().click();

  await page.getByLabel('API Token').fill('cf-token-123');
  await page.getByRole('button', { name: 'Connect' }).click();

  await expect(page.locator('#cf-tunnel')).toBeVisible();
  await page.getByLabel(/Tunnel Name/).fill('homelab-tunnel');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3 (Adopt) is skipped when no adoptable stacks exist

  // Step 4: Complete
  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  await expect(page.getByText('Exposure providers configured: Cloudflare')).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByText('Setup complete! Welcome to Labrador.')).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('completes onboarding happy path without adoptable stacks — skips adopt step', async ({ page }) => {
  await page.request.post('/api/test/reset?seed=false');
  await page.request.post('/api/test/mock/docker', { data: { containers: [] } });

  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step indicator should NOT show "Adopt"
  await expect(page.getByText('Adopt')).not.toBeVisible();

  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('heading', { name: 'Configure Exposure Providers' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  // Should jump directly to Complete, no Adopt step
  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByText('Setup complete! Welcome to Labrador.')).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('onboarding shows adopt step when unmanaged stacks exist', async ({ page }) => {
  await page.request.post('/api/test/reset?seed=false');
  await page.request.post('/api/test/mock/docker', {
    data: {
      containers: [{
        Id: 'myapp-web-1-id',
        Names: ['/myapp-web-1'],
        Image: 'nginx:latest',
        State: 'running',
        Status: 'Up 2 hours',
        Created: 1700000000,
        Ports: [],
        Labels: {
          'com.docker.compose.project': 'myapp',
          'com.docker.compose.project.working_dir': '/srv/myapp',
        },
        ImageID: 'sha256:abc',
        Command: 'nginx',
        HostConfig: { NetworkMode: 'bridge' },
        NetworkSettings: { Networks: {} },
        Mounts: [],
      }],
    },
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 1: Create account
  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Step 2: Skip providers
  await expect(page.getByRole('heading', { name: 'Configure Exposure Providers' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  // Step 3: Adopt — should show the adopt step with the stack
  await expect(page.getByRole('heading', { name: 'Adopt Existing Stacks' })).toBeVisible();
  await expect(page.getByText('myapp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /adopt selected/i }).click();

  await expect(page.getByText('Adopted 1 stack')).toBeVisible();

  // Step 4: Complete
  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByText('Setup complete! Welcome to Labrador.')).toBeVisible();
});

test('onboarding adopt step can be skipped', async ({ page }) => {
  await page.request.post('/api/test/reset?seed=false');
  await page.request.post('/api/test/mock/docker', {
    data: {
      containers: [{
        Id: 'myapp-web-1-id',
        Names: ['/myapp-web-1'],
        Image: 'nginx:latest',
        State: 'running',
        Status: 'Up 2 hours',
        Created: 1700000000,
        Ports: [],
        Labels: {
          'com.docker.compose.project': 'myapp',
          'com.docker.compose.project.working_dir': '/srv/myapp',
        },
        ImageID: 'sha256:abc',
        Command: 'nginx',
        HostConfig: { NetworkMode: 'bridge' },
        NetworkSettings: { Networks: {} },
        Mounts: [],
      }],
    },
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 1: Create account
  await page.getByLabel('Username').fill('admin_user');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Step 2: Skip providers
  await page.getByRole('button', { name: 'Skip' }).click();

  // Step 3: Skip adopt
  await expect(page.getByRole('heading', { name: 'Adopt Existing Stacks' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  // Step 4: Complete
  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Started' }).click();

  await expect(page.getByText('Setup complete! Welcome to Labrador.')).toBeVisible();
});
