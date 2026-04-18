import type {
  ExposureProvider,
  ExposureRoute,
  ValidationResult,
  ProviderHealth,
  RouteStatus,
} from '@shared/exposure/provider.interface.js';

export abstract class BaseProvider implements ExposureProvider {
  abstract readonly type: string;
  abstract readonly name: string;

  protected config: Record<string, any> = {};

  async initialize(config: Record<string, any>): Promise<void> {
    this.config = config;
  }

  abstract validateConfig(config: Record<string, any>): Promise<ValidationResult>;
  abstract testConnection(): Promise<boolean>;
  abstract addRoute(route: ExposureRoute): Promise<void>;
  abstract updateRoute(route: ExposureRoute): Promise<void>;
  abstract removeRoute(routeId: string): Promise<void>;
  abstract getRouteStatus(routeId: string): Promise<RouteStatus>;
  abstract getHealth(): Promise<ProviderHealth>;

  async cleanup(): Promise<void> {
    this.config = {};
  }
}
