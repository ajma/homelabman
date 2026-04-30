import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/index.js", () => ({ getDatabase: vi.fn() }));

import { getDatabase } from "../../db/index.js";
import { ExposureService } from "../exposure/exposure.service.js";

const PROJECT = {
  id: "proj-1",
  exposureEnabled: true,
  exposureProviderId: "prov-1",
  domainName: "app.example.com",
  exposureConfig: JSON.stringify({ port: 8080 }),
};

const CADDY_PROVIDER = {
  id: "prov-1",
  providerType: "caddy",
  enabled: true,
  configuration: JSON.stringify({ adminUrl: "http://localhost:2019" }),
};

const CLOUDFLARE_PROVIDER = {
  id: "prov-1",
  providerType: "cloudflare",
  enabled: true,
  configuration: JSON.stringify({ apiToken: "tok", tunnelId: "tun" }),
};

const mockProvider = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getRouteId: vi
    .fn()
    .mockImplementation(
      (project: { id: string; domainName?: string | null }) => project.id,
    ),
  addRoute: vi.fn().mockResolvedValue(undefined),
  removeRoute: vi.fn().mockResolvedValue(undefined),
  getRouteStatus: vi
    .fn()
    .mockResolvedValue({ active: true, domain: "app.example.com" }),
};

const mockRegistry = {
  get: vi.fn().mockReturnValue(mockProvider),
};

function makeDb(projectRow: any, providerRow: any) {
  let selectCallCount = 0;
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1)
            return Promise.resolve(projectRow ? [projectRow] : []);
          return Promise.resolve(providerRow ? [providerRow] : []);
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addProjectExposure", () => {
  it("returns early if project not found", async () => {
    const db = makeDb(null, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("returns early if exposure not enabled", async () => {
    const db = makeDb({ ...PROJECT, exposureEnabled: false }, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("returns early if exposureProviderId is null", async () => {
    const db = makeDb({ ...PROJECT, exposureProviderId: null }, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("returns early if provider not found in DB", async () => {
    const db = makeDb(PROJECT, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("returns early if provider disabled", async () => {
    const db = makeDb(PROJECT, { ...CADDY_PROVIDER, enabled: false });
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("returns early if registry has no matching provider", async () => {
    const db = makeDb(PROJECT, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const registry = { get: vi.fn().mockReturnValue(undefined) };
    const service = new ExposureService(registry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("returns early if no domain set", async () => {
    const db = makeDb({ ...PROJECT, domainName: null }, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.initialize).toHaveBeenCalled();
    expect(mockProvider.addRoute).not.toHaveBeenCalled();
  });

  it("initializes provider and calls addRoute with correct ExposureRoute", async () => {
    const db = makeDb(PROJECT, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.initialize).toHaveBeenCalledWith({
      adminUrl: "http://localhost:2019",
    });
    expect(mockProvider.addRoute).toHaveBeenCalledWith({
      projectId: "proj-1",
      domain: "app.example.com",
      targetPort: 8080,
      targetHost: undefined,
      path: undefined,
      tls: undefined,
    });
  });

  it("parses JSON string configuration fields", async () => {
    const db = makeDb(
      {
        ...PROJECT,
        exposureConfig: JSON.stringify({
          port: 3000,
          targetHost: "myhost",
          path: "/app",
          tls: true,
        }),
      },
      {
        ...CADDY_PROVIDER,
        configuration: JSON.stringify({ adminUrl: "http://caddy:2019" }),
      },
    );
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.initialize).toHaveBeenCalledWith({
      adminUrl: "http://caddy:2019",
    });
    expect(mockProvider.addRoute).toHaveBeenCalledWith({
      projectId: "proj-1",
      domain: "app.example.com",
      targetPort: 3000,
      targetHost: "myhost",
      path: "/app",
      tls: true,
    });
  });

  it("handles already-parsed object configuration", async () => {
    const db = makeDb(
      { ...PROJECT, exposureConfig: { port: 9090 } },
      { ...CADDY_PROVIDER, configuration: { adminUrl: "http://caddy:2019" } },
    );
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.initialize).toHaveBeenCalledWith({
      adminUrl: "http://caddy:2019",
    });
    expect(mockProvider.addRoute).toHaveBeenCalledWith(
      expect.objectContaining({ targetPort: 9090 }),
    );
  });

  it("defaults targetPort to 80 when exposureConfig has no port", async () => {
    const db = makeDb(
      { ...PROJECT, exposureConfig: JSON.stringify({}) },
      CADDY_PROVIDER,
    );
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.addProjectExposure("proj-1");

    expect(mockProvider.addRoute).toHaveBeenCalledWith(
      expect.objectContaining({ targetPort: 80 }),
    );
  });
});

describe("removeProjectExposure", () => {
  it("calls removeRoute with projectId for caddy provider", async () => {
    const db = makeDb(PROJECT, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.removeProjectExposure("proj-1");

    expect(mockProvider.initialize).toHaveBeenCalledWith({
      adminUrl: "http://localhost:2019",
    });
    expect(mockProvider.removeRoute).toHaveBeenCalledWith("proj-1");
  });

  it("calls removeRoute with domain for cloudflare provider", async () => {
    const db = makeDb(PROJECT, CLOUDFLARE_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    mockProvider.getRouteId.mockReturnValueOnce("app.example.com");
    const service = new ExposureService(mockRegistry as any);

    await service.removeProjectExposure("proj-1");

    expect(mockProvider.removeRoute).toHaveBeenCalledWith("app.example.com");
  });

  it("returns early if project not found", async () => {
    const db = makeDb(null, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.removeProjectExposure("proj-1");

    expect(mockProvider.removeRoute).not.toHaveBeenCalled();
  });

  it("returns early if exposureProviderId is null", async () => {
    const db = makeDb({ ...PROJECT, exposureProviderId: null }, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.removeProjectExposure("proj-1");

    expect(mockProvider.removeRoute).not.toHaveBeenCalled();
  });

  it("returns early if provider config not found in DB", async () => {
    const db = makeDb(PROJECT, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    await service.removeProjectExposure("proj-1");

    expect(mockProvider.removeRoute).not.toHaveBeenCalled();
  });

  it("falls back to projectId when cloudflare project has no domain", async () => {
    const db = makeDb({ ...PROJECT, domainName: null }, CLOUDFLARE_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    mockProvider.getRouteId.mockReturnValueOnce("proj-1");
    const service = new ExposureService(mockRegistry as any);

    await service.removeProjectExposure("proj-1");

    expect(mockProvider.removeRoute).toHaveBeenCalledWith("proj-1");
  });
});

describe("getProjectExposureStatus", () => {
  it("returns null if project not found", async () => {
    const db = makeDb(null, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(result).toBeNull();
    expect(mockProvider.getRouteStatus).not.toHaveBeenCalled();
  });

  it("returns null if exposure not enabled", async () => {
    const db = makeDb({ ...PROJECT, exposureEnabled: false }, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(result).toBeNull();
  });

  it("returns null if exposureProviderId is null", async () => {
    const db = makeDb({ ...PROJECT, exposureProviderId: null }, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(result).toBeNull();
  });

  it("returns null if provider config not found in DB", async () => {
    const db = makeDb(PROJECT, null);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(result).toBeNull();
  });

  it("returns null if registry has no matching provider", async () => {
    const db = makeDb(PROJECT, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const registry = { get: vi.fn().mockReturnValue(undefined) };
    const service = new ExposureService(registry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(result).toBeNull();
  });

  it("calls getRouteStatus with projectId for caddy provider", async () => {
    const db = makeDb(PROJECT, CADDY_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    const service = new ExposureService(mockRegistry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(mockProvider.initialize).toHaveBeenCalledWith({
      adminUrl: "http://localhost:2019",
    });
    expect(mockProvider.getRouteStatus).toHaveBeenCalledWith("proj-1");
    expect(result).toEqual({ active: true, domain: "app.example.com" });
  });

  it("calls getRouteStatus with domain for cloudflare provider", async () => {
    const db = makeDb(PROJECT, CLOUDFLARE_PROVIDER);
    vi.mocked(getDatabase).mockReturnValue(db as any);
    mockProvider.getRouteId.mockReturnValueOnce("app.example.com");
    const service = new ExposureService(mockRegistry as any);

    const result = await service.getProjectExposureStatus("proj-1");

    expect(mockProvider.getRouteStatus).toHaveBeenCalledWith("app.example.com");
    expect(result).toEqual({ active: true, domain: "app.example.com" });
  });
});
