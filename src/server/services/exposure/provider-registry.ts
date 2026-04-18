import type { ExposureProvider } from '@shared/exposure/provider.interface.js';

export class ExposureProviderRegistry {
  private providers = new Map<string, ExposureProvider>();

  register(provider: ExposureProvider): void {
    this.providers.set(provider.type, provider);
  }

  get(type: string): ExposureProvider | undefined {
    return this.providers.get(type);
  }

  getAll(): ExposureProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}
