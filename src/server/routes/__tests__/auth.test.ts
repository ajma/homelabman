import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
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
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: "test-secret",
    cookie: { cookieName: "token", signed: false },
  });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

const fakeUser = {
  id: "u1",
  username: "admin",
  passwordHash: "hashed",
  createdAt: 1000,
  updatedAt: 1000,
};

describe("POST /register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates user and returns 201 when no users exist", async () => {
    const { getDatabase } = await import("../../db/index.js");
    const insertValuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([fakeUser]),
    });
    const insertSettingsMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    let insertCallCount = 0;
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => Promise.resolve([]),
      }),
      insert: vi.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return { values: insertValuesMock };
        }
        return insertSettingsMock();
      }),
    } as any);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/register",
      payload: { username: "admin", password: "password123" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe("u1");
    expect(body.username).toBe("admin");
    expect(res.cookies.some((c: any) => c.name === "token")).toBe(true);
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);
  });

  it("returns 403 when a user already exists", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => Promise.resolve([fakeUser]),
      }),
    } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/register",
      payload: { username: "newuser", password: "password123" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain("Registration is disabled");
  });

  it("returns 400 for invalid input", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/register",
      payload: { username: "ab", password: "password123" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid input");
  });
});

describe("POST /login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 for valid credentials", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([fakeUser]),
        }),
      }),
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { username: "admin", password: "password123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("u1");
    expect(body.username).toBe("admin");
    expect(res.cookies.some((c: any) => c.name === "token")).toBe(true);
  });

  it("returns 401 for nonexistent username", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { username: "nobody", password: "password123" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid username or password");
  });

  it("returns 401 for wrong password", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([fakeUser]),
        }),
      }),
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { username: "admin", password: "wrongpassword" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid username or password");
  });

  it("returns 400 for invalid input", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { username: "admin" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid input");
  });
});

describe("POST /logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success: true", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/logout",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
  });
});

describe("GET /status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns needsOnboarding=true when no users exist", async () => {
    const { getDatabase } = await import("../../db/index.js");
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => Promise.resolve([]),
      }),
    } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ needsOnboarding: true, authenticated: false });
  });

  it("returns needsOnboarding=false, authenticated=false when user exists but no JWT", async () => {
    const { getDatabase } = await import("../../db/index.js");
    let selectCallCount = 0;
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // users table query
            return Promise.resolve([fakeUser]);
          }
          // settings table query
          return {
            where: () =>
              Promise.resolve([{ userId: "u1", onboardingCompleted: true }]),
          };
        },
      }),
    } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/status",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.needsOnboarding).toBe(false);
    expect(body.authenticated).toBe(false);
  });

  it("returns authenticated=false when JWT verification fails", async () => {
    const { getDatabase } = await import("../../db/index.js");
    let selectCallCount = 0;
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve([fakeUser]);
          }
          return {
            where: () =>
              Promise.resolve([{ userId: "u1", onboardingCompleted: true }]),
          };
        },
      }),
    } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/status",
      cookies: { token: "invalid-jwt-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.authenticated).toBe(false);
  });
});
