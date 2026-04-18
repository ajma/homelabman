import type {
  ExposureRoute,
  ValidationResult,
  ProviderHealth,
  RouteStatus,
} from '@shared/exposure/provider.interface.js';
import { BaseProvider } from './base.provider.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface TunnelHostname {
  hostname?: string;
  service: string;
  originRequest?: Record<string, any>;
}

interface TunnelConfig {
  ingress: TunnelHostname[];
}

export class CloudflareProvider extends BaseProvider {
  readonly type = 'cloudflare';
  readonly name = 'Cloudflare Tunnel';

  private get apiToken(): string {
    return this.config.api_token as string;
  }

  private get accountId(): string {
    return this.config.account_id as string;
  }

  private get tunnelId(): string {
    return this.config.tunnel_id as string;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private configUrl(): string {
    return `${CF_API_BASE}/accounts/${this.accountId}/cfd_tunnel/${this.tunnelId}/configurations`;
  }

  private tunnelUrl(): string {
    return `${CF_API_BASE}/accounts/${this.accountId}/cfd_tunnel/${this.tunnelId}`;
  }

  async validateConfig(config: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.api_token || typeof config.api_token !== 'string') {
      errors.push('api_token is required');
    }
    if (!config.account_id || typeof config.account_id !== 'string') {
      errors.push('account_id is required');
    }
    if (!config.tunnel_id || typeof config.tunnel_id !== 'string') {
      errors.push('tunnel_id is required');
    }

    if (errors.length === 0 && !config.tunnel_token) {
      warnings.push('tunnel_token not set; getComposeTemplate will not include a token');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(this.tunnelUrl(), {
        headers: this.headers(),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  private async getTunnelConfig(): Promise<TunnelConfig> {
    const res = await fetch(this.configUrl(), {
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to get tunnel config (${res.status}): ${body}`);
    }
    const data = await res.json();
    return data.result?.config || { ingress: [{ service: 'http_status:404' }] };
  }

  private async putTunnelConfig(config: TunnelConfig): Promise<void> {
    const res = await fetch(this.configUrl(), {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ config }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to update tunnel config (${res.status}): ${body}`);
    }
  }

  async addRoute(route: ExposureRoute): Promise<void> {
    const config = await this.getTunnelConfig();
    const targetHost = route.targetHost || 'localhost';
    const service = `http://${targetHost}:${route.targetPort}`;

    // Remove catch-all, add new entry, re-add catch-all
    const catchAll = config.ingress.find((e) => !e.hostname);
    const entries = config.ingress.filter((e) => e.hostname);

    // Check if hostname already exists
    const existing = entries.findIndex((e) => e.hostname === route.domain);
    if (existing >= 0) {
      entries[existing] = { hostname: route.domain, service };
    } else {
      entries.push({ hostname: route.domain, service });
    }

    // Catch-all must be last
    config.ingress = [...entries, catchAll || { service: 'http_status:404' }];
    await this.putTunnelConfig(config);
  }

  async updateRoute(route: ExposureRoute): Promise<void> {
    // addRoute handles upsert logic
    await this.addRoute(route);
  }

  async removeRoute(routeId: string): Promise<void> {
    // routeId is the projectId; we need to look up the domain from the project.
    // Since we don't have the domain here, we search by a convention: the route
    // was added with a known domain. We'll look through ingress entries for any
    // matching the pattern. For a more robust approach, we store the domain in
    // the project's exposureConfig.
    // For now, we'll remove by iterating and matching service or by the caller
    // passing the domain as routeId.
    const config = await this.getTunnelConfig();
    const catchAll = config.ingress.find((e) => !e.hostname);
    const entries = config.ingress.filter(
      (e) => e.hostname && e.hostname !== routeId,
    );

    config.ingress = [...entries, catchAll || { service: 'http_status:404' }];
    await this.putTunnelConfig(config);
  }

  async getRouteStatus(routeId: string): Promise<RouteStatus> {
    try {
      const config = await this.getTunnelConfig();
      const entry = config.ingress.find((e) => e.hostname === routeId);
      if (entry) {
        return { active: true, domain: entry.hostname || '', message: 'Route configured in tunnel' };
      }
      return { active: false, domain: '', message: 'Route not found in tunnel config' };
    } catch {
      return { active: false, domain: '', message: 'Unable to reach Cloudflare API' };
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    try {
      const res = await fetch(this.tunnelUrl(), {
        headers: this.headers(),
      });
      if (!res.ok) {
        return {
          healthy: false,
          message: `Cloudflare API returned ${res.status}`,
          lastChecked: new Date(),
        };
      }
      const data = await res.json();
      const tunnel = data.result;
      const healthy = tunnel?.status === 'healthy' || tunnel?.status === 'active';
      return {
        healthy,
        message: `Tunnel status: ${tunnel?.status || 'unknown'}`,
        lastChecked: new Date(),
      };
    } catch (err: any) {
      return {
        healthy: false,
        message: `Cannot reach Cloudflare API: ${err.message}`,
        lastChecked: new Date(),
      };
    }
  }

  getComposeTemplate(config: Record<string, any>): string | null {
    const token = config.tunnel_token;
    if (!token) return null;

    return `services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run --token \${TUNNEL_TOKEN}
    environment:
      - TUNNEL_TOKEN=${token}
`;
  }
}
