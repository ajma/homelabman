import { expect, test } from "@playwright/test";

const composeContent = "services:\n  web:\n    image: nginx:latest\n";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/test/reset");
  await page.goto("/api/test/session");
});

test("creates a project with a config file and sees it when re-opening", async ({
  page,
}) => {
  // Create project via UI
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Config Test");
  const composeEditor = page.locator(".cm-content").first();
  await composeEditor.click();
  await composeEditor.fill(composeContent);

  // Add a config file
  await page.getByRole("button", { name: "Add File" }).click();
  await page.getByPlaceholder("filename.conf").fill("nginx.conf");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Fill in config file content
  const configEditor = page.locator(".cm-content").last();
  await configEditor.click();
  await configEditor.fill("server { listen 80; }");

  // Create the project
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);

  // Verify config file appears
  await expect(page.getByText("nginx.conf")).toBeVisible();
});

test("edits a config file content and verifies it persists after save", async ({
  page,
}) => {
  // Create project via API with a config file
  const res = await page.request.post("/api/projects", {
    data: {
      name: "Edit Config Test",
      composeContent,
      configFiles: [{ filename: "app.conf", content: "original" }],
    },
  });
  const project = await res.json();

  // Navigate to editor
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("app.conf")).toBeVisible();

  // Expand the config file
  await page.getByText("app.conf").click();

  // Edit content — find the config editor (second .cm-content on page)
  const configEditor = page.locator(".cm-content").last();
  await configEditor.click();
  await page.keyboard.press("Meta+a");
  await page.keyboard.type("updated content");

  // Save
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project updated")).toBeVisible();

  // Reload and verify
  await page.reload();
  await page.goto("/api/test/session");
  await page.goto(`/projects/${project.id}`);
  await page.getByText("app.conf").click();
  const editor = page.locator(".cm-content").last();
  await expect(editor).toContainText("updated content");
});

test("adds a second config file and both appear after save", async ({
  page,
}) => {
  // Create project via API with one config file
  const res = await page.request.post("/api/projects", {
    data: {
      name: "Multi Config",
      composeContent,
      configFiles: [{ filename: "first.conf", content: "one" }],
    },
  });
  const project = await res.json();

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("first.conf")).toBeVisible();

  // Add second file
  await page.getByRole("button", { name: "Add File" }).click();
  await page.getByPlaceholder("filename.conf").fill("second.conf");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Save
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project updated")).toBeVisible();

  // Reload and verify both appear
  await page.reload();
  await page.goto("/api/test/session");
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("first.conf")).toBeVisible();
  await expect(page.getByText("second.conf")).toBeVisible();
});

test("deletes a config file and it is gone after save", async ({ page }) => {
  // Create project via API with two config files
  const res = await page.request.post("/api/projects", {
    data: {
      name: "Delete Config",
      composeContent,
      configFiles: [
        { filename: "keep.conf", content: "keep" },
        { filename: "remove.conf", content: "remove" },
      ],
    },
  });
  const project = await res.json();

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("keep.conf")).toBeVisible();
  await expect(page.getByText("remove.conf")).toBeVisible();

  // Delete remove.conf
  await page.getByLabel("Delete remove.conf").click();

  // Save
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project updated")).toBeVisible();

  // Reload and verify
  await page.reload();
  await page.goto("/api/test/session");
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("keep.conf")).toBeVisible();
  await expect(page.getByText("remove.conf")).not.toBeVisible();
});

test("rejects reserved filenames in the UI", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Reserved Test");

  // Try to add a reserved filename
  await page.getByRole("button", { name: "Add File" }).click();
  await page.getByPlaceholder("filename.conf").fill("docker-compose.yml");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Should show error
  await expect(page.getByText("Reserved filename")).toBeVisible();
});
