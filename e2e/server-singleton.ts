import type { FastifyInstance } from "fastify";

let server: FastifyInstance | null = null;
let dbPath: string | null = null;
let composeDir: string | null = null;

export function setServer(
  app: FastifyInstance,
  path: string,
  composeDirPath?: string,
) {
  server = app;
  dbPath = path;
  composeDir = composeDirPath ?? null;
}

export function getServer() {
  return { server, dbPath, composeDir };
}
