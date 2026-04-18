import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import fs from 'fs';
import path from 'path';

let db: ReturnType<typeof drizzle>;

export function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || './data/homelabman.db';

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const client = createClient({ url: `file:${dbPath}` });

  db = drizzle(client, { schema });
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export type AppDatabase = ReturnType<typeof initDatabase>;
