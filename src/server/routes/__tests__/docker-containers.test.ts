import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { dockerRoutes } from '../docker.routes.js';

vi.mock('../../middleware/auth.middleware.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    request.user = { id: 'user-1' };
  }),
}));

const mockDockerService = {
  startContainer: vi.fn(),
  stopContainer: vi.fn(),
  restartContainer: vi.fn(),
  removeContainer: vi.fn(),
  listContainers: vi.fn(),
  listNetworks: vi.fn(),
  inspectNetworks: vi.fn(),
  createNetwork: vi.fn(),
  removeNetwork: vi.fn(),
  listImages: vi.fn(),
  removeImage: vi.fn(),
  pullImage: vi.fn(),
  pruneImages: vi.fn(),
};

async function buildApp({ withDocker = true } = {}) {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: 'test-secret' });
  if (withDocker) {
    (app as any).dockerService = mockDockerService;
  }
  await app.register(dockerRoutes);
  await app.ready();
  return app;
}

describe('container action routes', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('POST /containers/:id/start', () => {
    it('starts a container and returns success', async () => {
      mockDockerService.startContainer.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/start' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      expect(mockDockerService.startContainer).toHaveBeenCalledWith('abc123');
    });

    it('returns 503 when Docker is unavailable', async () => {
      const app = await buildApp({ withDocker: false });
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/start' });
      expect(res.statusCode).toBe(503);
    });

    it('returns 500 when Docker throws', async () => {
      mockDockerService.startContainer.mockRejectedValue(new Error('container already started'));
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/start' });
      expect(res.statusCode).toBe(500);
    });
  });

  describe('POST /containers/:id/stop', () => {
    it('stops a container and returns success', async () => {
      mockDockerService.stopContainer.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/stop' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      expect(mockDockerService.stopContainer).toHaveBeenCalledWith('abc123');
    });

    it('returns 503 when Docker is unavailable', async () => {
      const app = await buildApp({ withDocker: false });
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/stop' });
      expect(res.statusCode).toBe(503);
    });
  });

  describe('POST /containers/:id/restart', () => {
    it('restarts a container and returns success', async () => {
      mockDockerService.restartContainer.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/restart' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      expect(mockDockerService.restartContainer).toHaveBeenCalledWith('abc123');
    });

    it('returns 503 when Docker is unavailable', async () => {
      const app = await buildApp({ withDocker: false });
      const res = await app.inject({ method: 'POST', url: '/containers/abc123/restart' });
      expect(res.statusCode).toBe(503);
    });
  });

  describe('DELETE /containers/:id', () => {
    it('removes a container and returns success', async () => {
      mockDockerService.removeContainer.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: '/containers/abc123' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      expect(mockDockerService.removeContainer).toHaveBeenCalledWith('abc123', false);
    });

    it('passes force=true when query param is set', async () => {
      mockDockerService.removeContainer.mockResolvedValue(undefined);
      const app = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: '/containers/abc123?force=true' });
      expect(res.statusCode).toBe(200);
      expect(mockDockerService.removeContainer).toHaveBeenCalledWith('abc123', true);
    });

    it('returns 503 when Docker is unavailable', async () => {
      const app = await buildApp({ withDocker: false });
      const res = await app.inject({ method: 'DELETE', url: '/containers/abc123' });
      expect(res.statusCode).toBe(503);
    });

    it('returns 500 when Docker throws', async () => {
      mockDockerService.removeContainer.mockRejectedValue(new Error('no such container'));
      const app = await buildApp();
      const res = await app.inject({ method: 'DELETE', url: '/containers/abc123' });
      expect(res.statusCode).toBe(500);
    });
  });
});
