import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { dockerRoutes } from "../docker.routes.js";

vi.mock("../../middleware/auth.middleware.js", () => ({
  authenticate: vi.fn(async (request: any) => {
    request.user = { id: "user-1" };
  }),
}));

const mockDockerService = {
  startContainer: vi.fn(),
  stopContainer: vi.fn(),
  restartContainer: vi.fn(),
  removeContainer: vi.fn(),
  listContainers: vi.fn(),
  listNetworks: vi.fn(),
  inspectNetworks: vi.fn(),
  createNetwork: vi.fn(),
  removeNetwork: vi.fn(),
  listImages: vi.fn(),
  removeImage: vi.fn(),
  pullImage: vi.fn(),
  pruneImages: vi.fn(),
};

async function buildApp({ withDocker = true } = {}) {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "test-secret" });
  if (withDocker) {
    (app as any).dockerService = mockDockerService;
  }
  await app.register(dockerRoutes);
  await app.ready();
  return app;
}

describe("DELETE /images/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 409 when image is in use by a container (matching ImageID)", async () => {
    mockDockerService.listContainers.mockResolvedValue([
      { Id: "c1", ImageID: "sha256:img1", Image: "nginx:latest" },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/images/sha256:img1",
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("in use");
  });

  it("returns 409 when image is in use by a container (matching Image field)", async () => {
    mockDockerService.listContainers.mockResolvedValue([
      { Id: "c1", ImageID: "sha256:other", Image: "nginx:latest" },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/images/nginx:latest",
    });
    expect(res.statusCode).toBe(409);
  });

  it("deletes image when not in use", async () => {
    mockDockerService.listContainers.mockResolvedValue([]);
    mockDockerService.removeImage.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/images/sha256:img1",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockDockerService.removeImage).toHaveBeenCalledWith(
      "sha256:img1",
      false,
    );
  });

  it("passes force=true query param to removeImage", async () => {
    mockDockerService.listContainers.mockResolvedValue([]);
    mockDockerService.removeImage.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/images/sha256:img1?force=true",
    });
    expect(res.statusCode).toBe(200);
    expect(mockDockerService.removeImage).toHaveBeenCalledWith(
      "sha256:img1",
      true,
    );
  });

  it("returns 503 when Docker is unavailable", async () => {
    const app = await buildApp({ withDocker: false });
    const res = await app.inject({
      method: "DELETE",
      url: "/images/sha256:img1",
    });
    expect(res.statusCode).toBe(503);
  });
});
