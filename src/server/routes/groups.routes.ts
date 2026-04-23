import { FastifyInstance } from 'fastify';
import { createGroupSchema, reorderGroupsSchema, renameGroupSchema } from '../../shared/schemas.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { GroupService } from '../services/group.service.js';

export async function groupRoutes(app: FastifyInstance) {
  const groupService = new GroupService();
  app.addHook('preHandler', authenticate);

  // GET / — list all groups for the authenticated user
  app.get('/', async (request) => {
    const userId = (request.user as any).id;
    return groupService.listGroups(userId);
  });

  // POST / — create a group
  app.post('/', async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const userId = (request.user as any).id;
    const group = await groupService.createGroup(userId, parsed.data.name);
    return reply.code(201).send(group);
  });

  // PUT /reorder — must be registered BEFORE PUT /:id
  app.put('/reorder', async (request, reply) => {
    const parsed = reorderGroupsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const userId = (request.user as any).id;
    await groupService.reorderGroups(userId, parsed.data.ids);
    return reply.code(204).send();
  });

  // PUT /:id — rename a group
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = renameGroupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const userId = (request.user as any).id;
    try {
      const group = await groupService.renameGroup(request.params.id, userId, parsed.data.name);
      return group;
    } catch {
      return reply.code(404).send({ error: 'Group not found' });
    }
  });

  // DELETE /:id — delete group (sets group_id = null on its projects)
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = (request.user as any).id;
    await groupService.deleteGroup(request.params.id, userId);
    return reply.code(204).send();
  });
}
