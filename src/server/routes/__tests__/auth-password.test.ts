import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcrypt";
import { authRoutes } from "../auth.routes.js";

vi.mock("../../db/index.js", () => ({ getDatabase: vi.fn() }));
vi.mock("bcrypt");
vi.mock("../../middleware/auth.middleware.js", () => ({
  authenticate: vi.fn(async (request: any) => {
    request.user = { id: "user-123", username: "testuser" };
  }),
}));

async function buildApp() {
  process.env.NODE_ENV = "test";
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "test-secret" });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

describe("PUT /password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when body is missing newPassword", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/password",
      payload: { currentPassword: "oldpass123" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when currentPassword is wrong", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([{ id: "user-123", passwordHash: "hash" }]),
        }),
      }),
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/password",
      payload: { currentPassword: "wrongpass", newPassword: "newpassword123" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Current password is incorrect");
  });

  it("returns 200 and updates password when credentials are valid", async () => {
    const updateMock = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: "user-123" }]),
      }),
    });
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([{ id: "user-123", passwordHash: "hash" }]),
        }),
      }),
      update: updateMock,
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("newhash" as never);

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/password",
      payload: { currentPassword: "oldpass123", newPassword: "newpassword123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 12);
  });

  it("returns 404 when user is not found in the database", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
    } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/password",
      payload: { currentPassword: "oldpass123", newPassword: "newpassword123" },
    });
    expect(res.statusCode).toBe(404);
  });
});
