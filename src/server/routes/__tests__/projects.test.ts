import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";

// Use vi.hoisted so these are available when vi.mock factories run (they are hoisted)
const { mockProjectService, mockDeployService } = vi.hoisted(() => ({
  mockProjectService: {
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    reorderProjects: vi.fn(),
    updateProjectStatus: vi.fn(),
  },
  mockDeployService: {
    deploy: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    teardown: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../middleware/auth.middleware.js", () => ({
  authenticate: vi.fn(async (request: any) => {
    request.user = { id: "user-1", username: "admin" };
  }),
}));

// Mock ProjectService since it's instantiated at module level inside projects.routes.ts
vi.mock("../../services/project.service.js", () => ({
  ProjectService: vi.fn().mockImplementation(() => mockProjectService),
}));

// Mock fs/promises for DELETE /:id (fs.rm) and templates
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock DeployService since it's also constructed internally
vi.mock("../../services/deploy.service.js", () => ({
  DeployService: vi.fn().mockImplementation(() => mockDeployService),
}));

// Mock AdoptService
vi.mock("../../services/adopt.service.js", () => ({
  AdoptService: vi.fn().mockImplementation(() => ({})),
}));

// Mock ComposeValidatorService
vi.mock("../../services/compose-validator.service.js", () => ({
  ComposeValidatorService: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
  })),
}));

// Import after mocks are set up
import { projectRoutes } from "../projects.routes.js";

const mockDockerService = {
  listContainers: vi.fn().mockResolvedValue([]),
  getContainerLogs: vi.fn().mockResolvedValue("log output"),
  getProjectLogs: vi.fn().mockResolvedValue([]),
};

const PROJECT = {
  id: "proj-1",
  userId: "user-1",
  slug: "my-app",
  name: "My App",
  composeContent: "services:\n  web:\n    image: nginx\n",
  logoUrl: null,
  status: "stopped",
};

async function buildApp({ withDocker = true } = {}) {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "test-secret" });
  if (withDocker) {
    (app as any).dockerService = mockDockerService;
  }
  (app as any).appConfig = {
    projectsDir: "/data/projects",
    jwtSecret: "test-secret",
    port: 3000,
    nodeEnv: "test",
  };
  await app.register(projectRoutes);
  await app.ready();
  return app;
}

describe("project routes", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("POST /", () => {
    it("creates project with valid input and returns 201", async () => {
      mockProjectService.createProject.mockResolvedValue(PROJECT);
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "My App",
          composeContent: "services:\n  web:\n    image: nginx\n",
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual(PROJECT);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ name: "My App" }),
      );
    });

    it("returns 400 for invalid input (missing composeContent)", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/",
        payload: { name: "My App" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Invalid input");
    });
  });

  describe("GET /:id", () => {
    it("returns project when found", async () => {
      mockProjectService.getProject.mockResolvedValue(PROJECT);
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/proj-1",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(PROJECT);
      expect(mockProjectService.getProject).toHaveBeenCalledWith(
        "proj-1",
        "user-1",
      );
    });

    it("returns 404 when project not found", async () => {
      mockProjectService.getProject.mockResolvedValue(null);
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/proj-999",
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toHaveProperty("error", "Project not found");
    });
  });

  describe("DELETE /:id", () => {
    it("calls teardown and returns 204", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "DELETE",
        url: "/proj-1",
      });
      expect(res.statusCode).toBe(204);
      expect(mockDeployService.teardown).toHaveBeenCalledWith(
        "proj-1",
        "user-1",
      );
    });

    it("returns 404 when project not found", async () => {
      mockDeployService.teardown.mockRejectedValueOnce(
        new Error("Project not found"),
      );
      const app = await buildApp();
      const res = await app.inject({
        method: "DELETE",
        url: "/proj-999",
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toHaveProperty("error", "Project not found");
    });

    it("returns 500 when teardown fails", async () => {
      mockDeployService.teardown.mockRejectedValueOnce(
        new Error("teardown failed"),
      );
      const app = await buildApp();
      const res = await app.inject({
        method: "DELETE",
        url: "/proj-1",
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toHaveProperty("error", "teardown failed");
    });
  });

  describe("POST /:id/deploy", () => {
    it("returns 503 when Docker is unavailable", async () => {
      mockDeployService.deploy.mockRejectedValueOnce(
        new Error("Docker is not available"),
      );
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/proj-1/deploy",
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toHaveProperty("error", "Docker is not available");
    });

    it("returns success when deploy succeeds", async () => {
      mockDeployService.deploy.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/proj-1/deploy",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      expect(mockDeployService.deploy).toHaveBeenCalledWith(
        "proj-1",
        "user-1",
        expect.any(Object),
      );
    });

    it("returns 500 when deploy throws", async () => {
      mockDeployService.deploy.mockRejectedValueOnce(
        new Error("compose failed"),
      );
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/proj-1/deploy",
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toHaveProperty("error", "compose failed");
    });
  });

  describe("POST /:id/stop", () => {
    it("returns 503 when Docker is unavailable", async () => {
      mockDeployService.stop.mockRejectedValueOnce(
        new Error("Docker is not available"),
      );
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/proj-1/stop",
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toHaveProperty("error", "Docker is not available");
    });
  });

  describe("GET /:id/logs", () => {
    it("returns logs from all project containers", async () => {
      mockProjectService.getProject.mockResolvedValue(PROJECT);
      mockDockerService.getProjectLogs.mockResolvedValue([
        { container: "my-app-web-1", output: "log output" },
        { container: "my-app-db-1", output: "log output" },
      ]);
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/proj-1/logs",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.logs).toHaveLength(2);
      expect(body.logs[0]).toEqual({
        container: "my-app-web-1",
        output: "log output",
      });
      expect(body.logs[1]).toEqual({
        container: "my-app-db-1",
        output: "log output",
      });
    });

    it("returns 404 when project not found", async () => {
      mockProjectService.getProject.mockResolvedValue(null);
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/proj-999/logs",
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toHaveProperty("error", "Not found");
    });

    it("returns empty logs array when Docker is unavailable", async () => {
      mockProjectService.getProject.mockResolvedValue(PROJECT);
      const app = await buildApp({ withDocker: false });
      const res = await app.inject({
        method: "GET",
        url: "/proj-1/logs",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ logs: [] });
    });
  });

  describe("POST /compose/validate", () => {
    it("returns errors for missing content", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/compose/validate",
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(false);
      expect(body.errors[0].message).toBe("Content is required");
    });

    it("returns errors for oversized content", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/compose/validate",
        payload: { content: "x".repeat(102401) },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(false);
      expect(body.errors[0].message).toBe(
        "Content exceeds maximum size (100KB)",
      );
    });

    it("validates valid compose content", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/compose/validate",
        payload: { content: "services:\n  web:\n    image: nginx\n" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(true);
      expect(body.errors).toEqual([]);
    });
  });
});
