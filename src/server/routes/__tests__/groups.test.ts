import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { groupRoutes } from '../groups.routes.js';

vi.mock('../../middleware/auth.middleware.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    request.user = { id: 'user-1' };
  }),
}));

vi.mock('../../services/group.service.js', () => ({
  GroupService: vi.fn().mockImplementation(() => mockGroupService),
}));

const mockGroupService = {
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
  reorderGroups: vi.fn(),
};

const GROUP = { id: 'g-1', userId: 'user-1', name: 'Infra', sortOrder: 0, createdAt: 1000, updatedAt: 1000 };

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: 'test-secret' });
  await app.register(groupRoutes);
  await app.ready();
  return app;
}

describe('GET /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns groups list', async () => {
    mockGroupService.listGroups.mockResolvedValue([GROUP]);
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([GROUP]);
  });
});

describe('POST /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a group and returns 201', async () => {
    mockGroupService.createGroup.mockResolvedValue(GROUP);
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/', payload: { name: 'Infra' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Infra');
  });

  it('returns 400 for empty name', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/', payload: { name: '' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /groups/reorder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls reorderGroups and returns 204', async () => {
    mockGroupService.reorderGroups.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/reorder',
      payload: { ids: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'] },
    });
    expect(res.statusCode).toBe(204);
    expect(mockGroupService.reorderGroups).toHaveBeenCalledWith('user-1', ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']);
  });
});

describe('PUT /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames a group', async () => {
    mockGroupService.renameGroup.mockResolvedValue({ ...GROUP, name: 'Renamed' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/g-1',
      payload: { name: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Renamed');
  });

  it('returns 404 when group not found', async () => {
    mockGroupService.renameGroup.mockRejectedValue(new Error('Group not found'));
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/bad-id', payload: { name: 'X' } });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a group and returns 204', async () => {
    mockGroupService.deleteGroup.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/g-1' });
    expect(res.statusCode).toBe(204);
    expect(mockGroupService.deleteGroup).toHaveBeenCalledWith('g-1', 'user-1');
  });
});
