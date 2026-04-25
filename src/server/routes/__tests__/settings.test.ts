import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { settingsRoutes } from "../settings.routes.js";

vi.mock("../../db/index.js", () => ({ getDatabase: vi.fn() }));
vi.mock("../../middleware/auth.middleware.js", () => ({
  authenticate: vi.fn(async (request: any) => {
    request.user = { id: "user-1", username: "admin" };
  }),
}));

const { getDatabase } = await import("../../db/index.js");

const mockProvider = {
  initialize: vi.fn().mockResolvedValue(undefined),
  checkSetup: vi.fn().mockResolvedValue({ allPassed: true, checks: [] }),
  listDomains: vi.fn().mockResolvedValue(["example.com"]),
};

const mockRegistry = {
  get: vi.fn().mockReturnValue(mockProvider),
};

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: "test-secret" });
  (app as any).providerRegistry = mockRegistry;
  await app.register(settingsRoutes);
  await app.ready();
  return app;
}

describe("settings routes", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("POST /exposure-providers", () => {
    it("creates provider and returns parsed configuration", async () => {
      const created = {
        id: "prov-1",
        userId: "user-1",
        providerType: "caddy",
        name: "My Caddy",
        enabled: true,
        configuration: '{"adminUrl":"http://localhost:2019"}',
      };
      vi.mocked(getDatabase).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/exposure-providers",
        payload: {
          providerType: "caddy",
          name: "My Caddy",
          configuration: { adminUrl: "http://localhost:2019" },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().configuration).toEqual({
        adminUrl: "http://localhost:2019",
      });
    });

    it("returns 400 for invalid input", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/exposure-providers",
        payload: { providerType: "unknown", name: "" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /exposure-providers/:id", () => {
    it("updates provider when owned by user", async () => {
      const existing = { id: "prov-1", userId: "user-1" };
      const updated = {
        ...existing,
        providerType: "caddy",
        name: "Updated",
        enabled: true,
        configuration: '{"adminUrl":"http://caddy:2019"}',
      };

      const whereFn = vi.fn();
      whereFn.mockResolvedValueOnce([existing]).mockReturnValueOnce({
        returning: vi.fn().mockResolvedValue([updated]),
      });

      vi.mocked(getDatabase).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: whereFn }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: whereFn }),
        }),
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: "PUT",
        url: "/exposure-providers/prov-1",
        payload: {
          providerType: "caddy",
          name: "Updated",
          configuration: { adminUrl: "http://caddy:2019" },
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when provider not owned by user", async () => {
      vi.mocked(getDatabase).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockResolvedValue([{ id: "prov-1", userId: "other-user" }]),
          }),
        }),
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: "PUT",
        url: "/exposure-providers/prov-1",
        payload: {
          providerType: "caddy",
          name: "Hijack",
          configuration: {},
        },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /exposure-providers/:id", () => {
    it("deletes provider when owned by user", async () => {
      vi.mocked(getDatabase).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockResolvedValue([{ id: "prov-1", userId: "user-1" }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: "DELETE",
        url: "/exposure-providers/prov-1",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
    });

    it("returns 404 when not owned by user", async () => {
      vi.mocked(getDatabase).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: "DELETE",
        url: "/exposure-providers/prov-1",
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /exposure-providers/check-setup", () => {
    it("returns 400 for missing providerType", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/exposure-providers/check-setup",
        payload: { configuration: {} },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for unknown provider type", async () => {
      mockRegistry.get.mockReturnValueOnce(null);
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/exposure-providers/check-setup",
        payload: { providerType: "unknown", configuration: {} },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Unknown provider type");
    });

    it("calls provider.checkSetup and returns result", async () => {
      const checkResult = {
        allPassed: true,
        checks: [{ name: "API Token", passed: true }],
      };
      mockProvider.checkSetup.mockResolvedValueOnce(checkResult);
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/exposure-providers/check-setup",
        payload: {
          providerType: "caddy",
          configuration: { adminUrl: "http://localhost:2019" },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(checkResult);
      expect(mockProvider.initialize).toHaveBeenCalledWith({
        adminUrl: "http://localhost:2019",
      });
    });
  });

  describe("POST /onboarding", () => {
    it("creates providers and sets onboardingCompleted", async () => {
      vi.mocked(getDatabase).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "prov-1" }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{}]),
            }),
          }),
        }),
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/onboarding",
        payload: {
          exposureProviders: [
            {
              providerType: "caddy",
              name: "Caddy",
              enabled: true,
              configuration: { adminUrl: "http://localhost:2019" },
            },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
    });

    it("returns 400 for invalid input", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/onboarding",
        payload: {
          exposureProviders: [{ providerType: "invalid" }],
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
