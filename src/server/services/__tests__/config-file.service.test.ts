import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigFileService } from "../config-file.service.js";

let tmpDir: string;
let service: ConfigFileService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "config-file-test-"));
  service = new ConfigFileService(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("readConfigFiles", () => {
  it("returns empty array when project directory does not exist", async () => {
    const result = await service.readConfigFiles("no-such-project");
    expect(result).toEqual([]);
  });

  it("returns empty array when project directory has only compose file", async () => {
    const projectDir = path.join(tmpDir, "my-app");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "docker-compose.yml"),
      "services:",
    );
    const result = await service.readConfigFiles("my-app");
    expect(result).toEqual([]);
  });

  it("reads config files from project directory, excluding compose files", async () => {
    const projectDir = path.join(tmpDir, "my-app");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "docker-compose.yml"),
      "services:",
    );
    await fs.writeFile(path.join(projectDir, "nginx.conf"), "server {}");
    await fs.writeFile(path.join(projectDir, "Caddyfile"), ":80");
    const result = await service.readConfigFiles("my-app");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ filename: "Caddyfile", content: ":80" });
    expect(result).toContainEqual({
      filename: "nginx.conf",
      content: "server {}",
    });
  });

  it("excludes all reserved compose filenames", async () => {
    const projectDir = path.join(tmpDir, "my-app");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "docker-compose.yml"), "a");
    await fs.writeFile(path.join(projectDir, "docker-compose.yaml"), "b");
    await fs.writeFile(path.join(projectDir, "compose.yml"), "c");
    await fs.writeFile(path.join(projectDir, "compose.yaml"), "d");
    await fs.writeFile(path.join(projectDir, "app.conf"), "e");
    const result = await service.readConfigFiles("my-app");
    expect(result).toEqual([{ filename: "app.conf", content: "e" }]);
  });

  it("skips subdirectories", async () => {
    const projectDir = path.join(tmpDir, "my-app");
    await fs.mkdir(path.join(projectDir, "subdir"), { recursive: true });
    await fs.writeFile(path.join(projectDir, "subdir", "nested.conf"), "x");
    await fs.writeFile(path.join(projectDir, "root.conf"), "y");
    const result = await service.readConfigFiles("my-app");
    expect(result).toEqual([{ filename: "root.conf", content: "y" }]);
  });
});

describe("writeConfigFiles", () => {
  it("creates project directory and writes files", async () => {
    await service.writeConfigFiles("new-app", [
      { filename: "nginx.conf", content: "server {}" },
    ]);
    const content = await fs.readFile(
      path.join(tmpDir, "new-app", "nginx.conf"),
      "utf-8",
    );
    expect(content).toBe("server {}");
  });

  it("writes multiple files", async () => {
    await service.writeConfigFiles("my-app", [
      { filename: "a.conf", content: "aaa" },
      { filename: "b.conf", content: "bbb" },
    ]);
    const a = await fs.readFile(path.join(tmpDir, "my-app", "a.conf"), "utf-8");
    const b = await fs.readFile(path.join(tmpDir, "my-app", "b.conf"), "utf-8");
    expect(a).toBe("aaa");
    expect(b).toBe("bbb");
  });

  it("does nothing when configFiles is empty", async () => {
    await service.writeConfigFiles("my-app", []);
  });
});

describe("syncConfigFiles", () => {
  it("deletes config files not in the provided array", async () => {
    const projectDir = path.join(tmpDir, "my-app");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "docker-compose.yml"),
      "services:",
    );
    await fs.writeFile(path.join(projectDir, "old.conf"), "old");
    await fs.writeFile(path.join(projectDir, "keep.conf"), "keep");

    await service.syncConfigFiles("my-app", [
      { filename: "keep.conf", content: "updated" },
    ]);

    const files = await fs.readdir(projectDir);
    expect(files).toContain("docker-compose.yml");
    expect(files).toContain("keep.conf");
    expect(files).not.toContain("old.conf");
    const content = await fs.readFile(
      path.join(projectDir, "keep.conf"),
      "utf-8",
    );
    expect(content).toBe("updated");
  });

  it("preserves compose files during sync", async () => {
    const projectDir = path.join(tmpDir, "my-app");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "docker-compose.yml"),
      "services:",
    );

    await service.syncConfigFiles("my-app", []);

    const files = await fs.readdir(projectDir);
    expect(files).toContain("docker-compose.yml");
  });

  it("handles missing project directory gracefully", async () => {
    await expect(
      service.syncConfigFiles("no-such-project", [
        { filename: "a.conf", content: "x" },
      ]),
    ).resolves.not.toThrow();
    const content = await fs.readFile(
      path.join(tmpDir, "no-such-project", "a.conf"),
      "utf-8",
    );
    expect(content).toBe("x");
  });
});
