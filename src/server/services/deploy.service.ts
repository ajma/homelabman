import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { DockerService } from "./docker.service.js";
import { ProjectService } from "./project.service.js";
import type { ExposureService } from "./exposure/exposure.service.js";
import { getDatabase } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { Project } from "../../shared/types.js";
import type { ConfigFile } from "../../shared/types.js";

export interface DeploymentListener {
  onProgress: (stage: string, message: string) => void;
  onComplete: (status: "success" | "error") => void;
  onError: (error: string) => void;
}

export class DeployService {
  constructor(
    private dockerService: DockerService | null,
    private projectService: ProjectService,
    private exposureService: ExposureService | null,
    private projectsDir: string,
    private hostProjectsDir?: string,
  ) {}

  private async writeProjectFiles(
    project: Project & { configFiles: ConfigFile[] },
  ): Promise<string> {
    const projectDir = path.join(this.projectsDir, project.slug);
    await fs.mkdir(projectDir, { recursive: true });

    let compose = this.injectLabels(
      project.composeContent,
      project.id,
      project.logoUrl,
    );
    compose = this.rewriteVolumePaths(compose, project.slug);
    await fs.writeFile(path.join(projectDir, "docker-compose.yml"), compose);

    for (const file of project.configFiles ?? []) {
      await fs.writeFile(path.join(projectDir, file.filename), file.content);
    }

    return path.join(projectDir, "docker-compose.yml");
  }

  private rewriteVolumePaths(composeContent: string, slug: string): string {
    if (!this.hostProjectsDir) return composeContent;
    const hostProjectDir = path.join(this.hostProjectsDir, slug);
    const parsed = yaml.load(composeContent) as any;
    if (!parsed?.services) return composeContent;

    for (const serviceName of Object.keys(parsed.services)) {
      const volumes = parsed.services[serviceName].volumes;
      if (!Array.isArray(volumes)) continue;
      parsed.services[serviceName].volumes = volumes.map((v: any) => {
        if (typeof v === "string") {
          const [src, ...rest] = v.split(":");
          if (src.startsWith("./") || src.startsWith("../")) {
            const abs = path.join(hostProjectDir, src);
            return [abs, ...rest].join(":");
          }
        } else if (
          v?.source?.startsWith("./") ||
          v?.source?.startsWith("../")
        ) {
          v.source = path.join(hostProjectDir, v.source);
        }
        return v;
      });
    }
    return yaml.dump(parsed);
  }

  /** Inject labrador labels into compose YAML so containers are trackable */
  private injectLabels(
    composeContent: string,
    projectId: string,
    logoUrl?: string | null,
  ): string {
    const parsed = yaml.load(composeContent) as any;
    if (parsed?.services) {
      for (const serviceName of Object.keys(parsed.services)) {
        if (!parsed.services[serviceName].labels) {
          parsed.services[serviceName].labels = {};
        }
        // Handle both array and object label formats
        if (Array.isArray(parsed.services[serviceName].labels)) {
          parsed.services[serviceName].labels.push(
            `labrador.managed=true`,
            `labrador.project_id=${projectId}`,
          );
          if (logoUrl) {
            parsed.services[serviceName].labels.push(
              `labrador.logo_url=${logoUrl}`,
            );
          }
        } else {
          parsed.services[serviceName].labels["labrador.managed"] = "true";
          parsed.services[serviceName].labels["labrador.project_id"] =
            projectId;
          if (logoUrl) {
            parsed.services[serviceName].labels["labrador.logo_url"] = logoUrl;
          }
        }
      }
    }
    return yaml.dump(parsed);
  }

  private requireDocker(): DockerService {
    if (!this.dockerService) throw new Error("Docker is not available");
    return this.dockerService;
  }

  async deploy(
    projectId: string,
    userId: string,
    listener?: DeploymentListener,
  ): Promise<void> {
    const docker = this.requireDocker();
    const db = getDatabase();
    const project = await this.projectService.getProject(projectId, userId);
    if (!project) throw new Error("Project not found");

    listener?.onProgress("preparing", "Preparing deployment...");

    await db
      .update(projects)
      .set({ status: "starting", updatedAt: Date.now() })
      .where(eq(projects.id, projectId));

    try {
      listener?.onProgress("preparing", "Writing project files...");
      const composeFile = await this.writeProjectFiles(project);

      listener?.onProgress("deploying", "Running docker compose up...");
      const result = await docker.composeUp(composeFile, project.slug);

      if (
        result.stderr &&
        !result.stderr.includes("Started") &&
        !result.stderr.includes("Running") &&
        !result.stderr.includes("Created")
      ) {
        listener?.onProgress("deploying", result.stderr);
      }

      await db
        .update(projects)
        .set({
          status: "running",
          deployedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(eq(projects.id, projectId));

      if (this.exposureService) {
        try {
          listener?.onProgress("exposure", "Configuring exposure routes...");
          await this.exposureService.addProjectExposure(projectId);
        } catch (exposureErr: any) {
          listener?.onProgress(
            "exposure",
            `Exposure setup failed: ${exposureErr.message}`,
          );
        }
      }

      listener?.onProgress("complete", "Deployment successful");
      listener?.onComplete("success");
    } catch (error: any) {
      await db
        .update(projects)
        .set({ status: "error", updatedAt: Date.now() })
        .where(eq(projects.id, projectId));

      listener?.onError(error.message);
      listener?.onComplete("error");
      throw error;
    }
  }

  async stop(projectId: string, userId: string): Promise<void> {
    const docker = this.requireDocker();
    const db = getDatabase();
    const project = await this.projectService.getProject(projectId, userId);
    if (!project) throw new Error("Project not found");

    const composeFile = await this.writeProjectFiles(project);

    if (this.exposureService) {
      try {
        await this.exposureService.removeProjectExposure(projectId);
      } catch {
        // Don't fail the stop for exposure errors
      }
    }

    try {
      await docker.composeDown(composeFile, project.slug);
    } catch {
      // If compose file doesn't exist, try stopping containers by label
    }

    await db
      .update(projects)
      .set({ status: "stopped", updatedAt: Date.now() })
      .where(eq(projects.id, projectId));
  }

  async restart(projectId: string, userId: string): Promise<void> {
    const docker = this.requireDocker();
    const db = getDatabase();
    const project = await this.projectService.getProject(projectId, userId);
    if (!project) throw new Error("Project not found");

    const composeFile = await this.writeProjectFiles(project);

    await docker.composeRestart(composeFile, project.slug);

    await db
      .update(projects)
      .set({ status: "running", updatedAt: Date.now() })
      .where(eq(projects.id, projectId));
  }

  async teardown(projectId: string, userId: string): Promise<void> {
    const project = await this.projectService.getProject(projectId, userId);
    if (!project) throw new Error("Project not found");

    if (
      this.dockerService &&
      (project.status === "running" || project.status === "starting")
    ) {
      try {
        await this.stop(projectId, userId);
      } catch {
        // Continue with deletion even if stop fails
      }
    }

    const projectDir = path.join(this.projectsDir, project.slug);
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch {
      // Continue with deletion even if directory cleanup fails
    }

    await this.projectService.deleteProject(projectId, userId);
  }
}
