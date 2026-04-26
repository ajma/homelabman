import { rm } from "fs/promises";
import { getServer } from "./server-singleton.js";

export default async function globalTeardown() {
  const { server, dbPath, composeDir } = getServer();
  if (server) await server.close();
  if (dbPath) await rm(dbPath, { force: true });
  if (composeDir) await rm(composeDir, { recursive: true, force: true });
}
