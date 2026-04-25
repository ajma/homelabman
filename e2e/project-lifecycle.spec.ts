import { expect, test } from "@playwright/test";

const composeContent = "services:\n  web:\n    image: nginx:latest\n";

function managedContainer(projectId: string) {
  return {
    Id: "c1-" + projectId,
    Names: ["/test-app-web-1"],
    Image: "nginx:latest",
    State: "running",
    Status: "Up 1 second",
    Created: Date.now() / 1000,
    Ports: [],
    Labels: {
      "labrador.managed": "true",
      "labrador.project_id": projectId,
      "com.docker.compose.project": "test-app",
    },
    ImageID: "sha256:abc",
    Command: "nginx",
    HostConfig: { NetworkMode: "bridge" },
    NetworkSettings: { Networks: {} },
    Mounts: [],
  };
}

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/test/reset");
  await page.goto("/api/test/session");
});

// ── Create ──

test("creates a project from the editor and lands on its edit page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Project" }).click();
  await expect(page).toHaveURL("/projects/new");

  // Fill project name
  await page.getByLabel("Project Name").fill("My Test Project");

  // Fill compose content in CodeMirror editor
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.fill(composeContent);

  // Submit the form
  await page.getByRole("button", { name: "Create" }).click();

  // After creation, useCreateProject navigates to /projects/:id
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);

  // The project header should show the name
  await expect(
    page.getByRole("heading", { name: "My Test Project" }),
  ).toBeVisible();
});

test("shows validation error when creating project without a name", async ({
  page,
}) => {
  await page.goto("/projects/new");

  // Fill only compose content, leave name empty
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.fill(composeContent);

  await page.getByRole("button", { name: "Create" }).click();

  // Should stay on the same page and show a validation error
  await expect(page).toHaveURL("/projects/new");
});

// ── Deploy ──

test("deploys a project from the editor page", async ({ page }) => {
  // Create project via API
  const res = await page.request.post("/api/projects", {
    data: { name: "Test App", composeContent },
  });
  const project = await res.json();

  // Set up mock containers so the project appears "running" after deploy
  await page.request.post("/api/test/mock/docker", {
    data: { containers: [managedContainer(project.id)] },
  });

  // Navigate to the project editor
  await page.goto(`/projects/${project.id}`);

  // Project should initially be stopped; the Deploy button should be visible
  await expect(page.getByRole("button", { name: "Deploy" })).toBeVisible();

  // Click deploy
  await page.getByRole("button", { name: "Deploy" }).click();

  // After deploy, the status should change to running (mock docker returns containers)
  await expect(
    page.locator("header").getByText("running", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
});

// ── Stop ──

test("stops a running project from the dashboard", async ({ page }) => {
  // Create project and set it to running
  const res = await page.request.post("/api/projects", {
    data: { name: "Running App", composeContent },
  });
  const project = await res.json();

  // Deploy it so its status becomes running
  await page.request.post("/api/test/mock/docker", {
    data: { containers: [managedContainer(project.id)] },
  });
  await page.request.post(`/api/projects/${project.id}/deploy`);

  // Wait for the status to settle
  await page.waitForTimeout(500);

  // Navigate to dashboard
  await page.goto("/");

  // The project card should show "Running App" with a Stop button
  await expect(page.locator("main").getByText("Running App")).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

  // Clear mock containers so after stopping the project shows as stopped
  await page.request.post("/api/test/mock/docker", {
    data: { containers: [] },
  });

  // Click stop on the card
  await page.getByRole("button", { name: "Stop" }).click();

  // Verify the project status changes to stopped
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Project stopped")).toBeVisible();
});

// ── Edit ──

test("edits a project name from the editor page", async ({ page }) => {
  // Create project via API
  const res = await page.request.post("/api/projects", {
    data: { name: "Original Name", composeContent },
  });
  const project = await res.json();

  // Navigate to editor
  await page.goto(`/projects/${project.id}`);
  await expect(
    page.getByRole("heading", { name: "Original Name" }),
  ).toBeVisible();

  // Update the name
  const nameInput = page.getByLabel("Project Name");
  await nameInput.clear();
  await nameInput.fill("Updated Name");

  // Save
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project updated")).toBeVisible();

  // Verify the header now shows the updated name
  await expect(page.locator("header").getByText("Updated Name")).toBeVisible();
});

// ── Delete ──

test("deletes a project from the editor page", async ({ page }) => {
  // Create project via API
  const res = await page.request.post("/api/projects", {
    data: { name: "Doomed Project", composeContent },
  });
  const project = await res.json();

  // Navigate to editor
  await page.goto(`/projects/${project.id}`);
  await expect(
    page.getByRole("heading", { name: "Doomed Project" }),
  ).toBeVisible();

  // Click the delete button in the danger zone
  await page.getByRole("button", { name: "Delete Project" }).click();

  // Confirm deletion
  await expect(page.getByText(/Delete.*Doomed Project/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm Delete" }).click();

  // Should navigate back to dashboard
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Project deleted")).toBeVisible();

  // Project should no longer appear
  await expect(page.getByText("Doomed Project")).not.toBeVisible();
});

// ── Full lifecycle ──

test("full lifecycle: create, deploy, stop, delete", async ({ page }) => {
  // 1. Create via UI
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Lifecycle App");
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.fill(composeContent);
  await page.getByRole("button", { name: "Create" }).click();

  // Should navigate to the project editor
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "Lifecycle App" }),
  ).toBeVisible();

  // Extract the project ID from the URL
  const url = page.url();
  const projectId = url.split("/projects/")[1];

  // 2. Deploy — set up mock containers, then click deploy
  await page.request.post("/api/test/mock/docker", {
    data: { containers: [managedContainer(projectId)] },
  });
  await page.getByRole("button", { name: "Deploy" }).click();

  // Wait for running status
  await expect(
    page.locator("header").getByText("running", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });

  // 3. Stop — clear containers and click stop
  await page.request.post("/api/test/mock/docker", {
    data: { containers: [] },
  });
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Project stopped")).toBeVisible();

  // 4. Delete
  await page.getByRole("button", { name: "Delete Project" }).click();
  await page.getByRole("button", { name: "Confirm Delete" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Project deleted")).toBeVisible();
  await expect(page.getByText("Lifecycle App")).not.toBeVisible();
});
