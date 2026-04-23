import { eq, and, sql } from 'drizzle-orm';
import { getDatabase } from '../db/index.js';
import { projectGroups, projects } from '../db/schema.js';
import type { ProjectGroup } from '../../shared/types.js';

export class GroupService {
  async listGroups(userId: string): Promise<ProjectGroup[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(projectGroups)
      .where(eq(projectGroups.userId, userId))
      .orderBy(projectGroups.sortOrder);
    return rows as ProjectGroup[];
  }

  async createGroup(userId: string, name: string): Promise<ProjectGroup> {
    const db = getDatabase();
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${projectGroups.sortOrder}), -1)` })
      .from(projectGroups)
      .where(eq(projectGroups.userId, userId));
    const [row] = await db
      .insert(projectGroups)
      .values({ userId, name, sortOrder: maxOrder + 1 })
      .returning();
    return row as ProjectGroup;
  }

  async renameGroup(groupId: string, userId: string, name: string): Promise<ProjectGroup> {
    const db = getDatabase();
    const [row] = await db
      .update(projectGroups)
      .set({ name, updatedAt: Date.now() })
      .where(and(eq(projectGroups.id, groupId), eq(projectGroups.userId, userId)))
      .returning();
    if (!row) throw new Error('Group not found');
    return row as ProjectGroup;
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      const [group] = await tx
        .select({ id: projectGroups.id })
        .from(projectGroups)
        .where(and(eq(projectGroups.id, groupId), eq(projectGroups.userId, userId)));
      if (!group) throw new Error('Group not found');
      await tx
        .update(projects)
        .set({ groupId: null, updatedAt: Date.now() })
        .where(eq(projects.groupId, groupId));
      await tx
        .delete(projectGroups)
        .where(eq(projectGroups.id, groupId));
    });
  }

  async reorderGroups(userId: string, ids: string[]): Promise<void> {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(projectGroups)
          .set({ sortOrder: i, updatedAt: Date.now() })
          .where(and(eq(projectGroups.id, ids[i]), eq(projectGroups.userId, userId)));
      }
    });
  }
}
