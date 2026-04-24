import { ExposureProviderRegistry } from "./provider-registry.js";
import { getDatabase } from "../../db/index.js";
import { projects, exposureProviders } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type {
  ExposureRoute,
  RouteStatus,
} from "@shared/exposure/provider.interface.js";

export class ExposureService {
  constructor(private registry: ExposureProviderRegistry) {}

  async addProjectExposure(projectId: string): Promise<void> {
    const db = getDatabase();

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return;

    if (!project.exposureEnabled || !project.exposureProviderId) return;

    const [providerConfig] = await db
      .select()
      .from(exposureProviders)
      .where(eq(exposureProviders.id, project.exposureProviderId));

    if (!providerConfig || !providerConfig.enabled) return;

    const provider = this.registry.get(providerConfig.providerType);
    if (!provider) return;

    const config =
      typeof providerConfig.configuration === "string"
        ? JSON.parse(providerConfig.configuration)
        : providerConfig.configuration;

    await provider.initialize(config);

    const exposureConfig =
      typeof project.exposureConfig === "string"
        ? JSON.parse(project.exposureConfig)
        : project.exposureConfig || {};

    const domain = project.domainName;
    if (!domain) return;

    const route: ExposureRoute = {
      projectId: project.id,
      domain,
      targetPort: exposureConfig.port || 80,
      targetHost: exposureConfig.targetHost,
      path: exposureConfig.path,
      tls: exposureConfig.tls,
    };

    await provider.addRoute(route);
  }

  async removeProjectExposure(projectId: string): Promise<void> {
    const db = getDatabase();

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return;

    if (!project.exposureProviderId) return;

    const [providerConfig] = await db
      .select()
      .from(exposureProviders)
      .where(eq(exposureProviders.id, project.exposureProviderId));

    if (!providerConfig) return;

    const provider = this.registry.get(providerConfig.providerType);
    if (!provider) return;

    const config =
      typeof providerConfig.configuration === "string"
        ? JSON.parse(providerConfig.configuration)
        : providerConfig.configuration;

    await provider.initialize(config);

    // For Caddy, routeId is the projectId. For Cloudflare, it's the domain.
    const routeId =
      providerConfig.providerType === "cloudflare"
        ? project.domainName || projectId
        : projectId;

    await provider.removeRoute(routeId);
  }

  async getProjectExposureStatus(
    projectId: string,
  ): Promise<RouteStatus | null> {
    const db = getDatabase();

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return null;

    if (!project.exposureEnabled || !project.exposureProviderId) {
      return null;
    }

    const [providerConfig] = await db
      .select()
      .from(exposureProviders)
      .where(eq(exposureProviders.id, project.exposureProviderId));

    if (!providerConfig) return null;

    const provider = this.registry.get(providerConfig.providerType);
    if (!provider) return null;

    const config =
      typeof providerConfig.configuration === "string"
        ? JSON.parse(providerConfig.configuration)
        : providerConfig.configuration;

    await provider.initialize(config);

    // For Caddy we look up by projectId, for Cloudflare by domain
    const routeId =
      providerConfig.providerType === "cloudflare"
        ? project.domainName || projectId
        : projectId;

    return provider.getRouteStatus(routeId);
  }
}
