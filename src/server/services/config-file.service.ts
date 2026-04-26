import fs from "fs/promises";
import path from "path";
import type { ConfigFile } from "../../shared/types.js";

const RESERVED_COMPOSE_FILES = new Set([
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
]);

export class ConfigFileService {
  constructor(private composeDir: string) {}

  async readConfigFiles(slug: string): Promise<ConfigFile[]> {
    const projectDir = path.join(this.composeDir, slug);
    let entries: string[];
    try {
      entries = await fs.readdir(projectDir);
    } catch {
      return [];
    }

    const files: ConfigFile[] = [];
    for (const entry of entries) {
      if (RESERVED_COMPOSE_FILES.has(entry.toLowerCase())) continue;
      const filePath = path.join(projectDir, entry);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      const content = await fs.readFile(filePath, "utf-8");
      files.push({ filename: entry, content });
    }
    return files;
  }

  async writeConfigFiles(
    slug: string,
    configFiles: ConfigFile[],
  ): Promise<void> {
    if (configFiles.length === 0) return;
    const projectDir = path.join(this.composeDir, slug);
    await fs.mkdir(projectDir, { recursive: true });
    for (const file of configFiles) {
      await fs.writeFile(path.join(projectDir, file.filename), file.content);
    }
  }

  async syncConfigFiles(
    slug: string,
    configFiles: ConfigFile[],
  ): Promise<void> {
    const projectDir = path.join(this.composeDir, slug);
    await fs.mkdir(projectDir, { recursive: true });

    for (const file of configFiles) {
      await fs.writeFile(path.join(projectDir, file.filename), file.content);
    }

    const keepSet = new Set(configFiles.map((f) => f.filename));
    let entries: string[];
    try {
      entries = await fs.readdir(projectDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (RESERVED_COMPOSE_FILES.has(entry.toLowerCase())) continue;
      if (keepSet.has(entry)) continue;
      const filePath = path.join(projectDir, entry);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      await fs.unlink(filePath);
    }
  }
}
