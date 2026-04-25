import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  createProjectSchema,
  exposureProviderSchema,
  changePasswordSchema,
} from "../schemas.js";

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short username", () => {
    const result = loginSchema.safeParse({
      username: "ab",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid alphanumeric username", () => {
    const result = registerSchema.safeParse({
      username: "admin_user",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects username with special characters", () => {
    const result = registerSchema.safeParse({
      username: "admin@user",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("accepts valid project", () => {
    const result = createProjectSchema.safeParse({
      name: "My Project",
      composeContent: "services:\n  web:\n    image: nginx",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createProjectSchema.safeParse({
      name: "",
      composeContent: "services:",
    });
    expect(result.success).toBe(false);
  });

  it("rejects composeContent over 100KB", () => {
    const result = createProjectSchema.safeParse({
      name: "Big Project",
      composeContent: "x".repeat(102401),
    });
    expect(result.success).toBe(false);
  });

  it("defaults exposureEnabled to false", () => {
    const result = createProjectSchema.safeParse({
      name: "My App",
      composeContent: "services:\n  web:\n    image: nginx",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.exposureEnabled).toBe(false);
    }
  });

  it("defaults sortOrder to 0", () => {
    const result = createProjectSchema.safeParse({
      name: "My App",
      composeContent: "services:\n  web:\n    image: nginx",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });
});

describe("exposureProviderSchema", () => {
  it("accepts valid caddy provider", () => {
    const result = exposureProviderSchema.safeParse({
      providerType: "caddy",
      name: "My Caddy",
      configuration: { adminUrl: "http://localhost:2019" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid cloudflare provider", () => {
    const result = exposureProviderSchema.safeParse({
      providerType: "cloudflare",
      name: "My Tunnel",
      configuration: { apiToken: "tok", tunnelId: "tun" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown providerType", () => {
    const result = exposureProviderSchema.safeParse({
      providerType: "nginx",
      name: "Bad Provider",
      configuration: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = exposureProviderSchema.safeParse({
      providerType: "caddy",
      name: "",
      configuration: {},
    });
    expect(result.success).toBe(false);
  });

  it("defaults enabled to true", () => {
    const result = exposureProviderSchema.safeParse({
      providerType: "caddy",
      name: "Caddy",
      configuration: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });
});

describe("changePasswordSchema", () => {
  it("accepts valid password change", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "newpass456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects newPassword under 8 chars", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when confirmPassword does not match", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "mismatch9",
    });
    expect(result.success).toBe(false);
  });
});
