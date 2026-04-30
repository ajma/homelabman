import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.middleware.js";
import { requiresDocker } from "../middleware/docker.middleware.js";
import { DockerService } from "../services/docker.service.js";

export async function dockerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requiresDocker);

  const dockerService = (app as any).dockerService as DockerService;

  // GET /containers - List all Docker containers
  app.get("/containers", async () => {
    return dockerService.listContainers();
  });

  // POST /containers/:id/start
  app.post<{ Params: { id: string } }>(
    "/containers/:id/start",
    async (request) => {
      await dockerService.startContainer(request.params.id);
      return { success: true };
    },
  );

  // POST /containers/:id/stop
  app.post<{ Params: { id: string } }>(
    "/containers/:id/stop",
    async (request) => {
      await dockerService.stopContainer(request.params.id);
      return { success: true };
    },
  );

  // POST /containers/:id/restart
  app.post<{ Params: { id: string } }>(
    "/containers/:id/restart",
    async (request) => {
      await dockerService.restartContainer(request.params.id);
      return { success: true };
    },
  );

  // DELETE /containers/:id
  app.delete<{ Params: { id: string }; Querystring: { force?: string } }>(
    "/containers/:id",
    async (request) => {
      const force = request.query.force === "true";
      await dockerService.removeContainer(request.params.id, force);
      return { success: true };
    },
  );

  // GET /networks - List Docker networks for a page, with Containers populated only for that page
  app.get<{ Querystring: { page?: string; pageSize?: string } }>(
    "/networks",
    async (request) => {
      const page = Math.max(1, parseInt(request.query.page ?? "1", 10));
      const pageSize = Math.min(
        50,
        Math.max(1, parseInt(request.query.pageSize ?? "15", 10)),
      );
      const all = await dockerService.listNetworks();
      const pageIds = all
        .slice((page - 1) * pageSize, page * pageSize)
        .map((n) => n.Id);
      const data = await dockerService.inspectNetworks(pageIds);
      return { data, total: all.length };
    },
  );

  // POST /networks - Create a network
  app.post<{ Body: { name: string; driver?: string } }>(
    "/networks",
    async (request, reply) => {
      const { name, driver } = request.body;
      if (!name || typeof name !== "string") {
        return reply.code(400).send({ error: "Network name is required" });
      }
      const network = await dockerService.createNetwork(name, driver);
      return { id: network.id, name };
    },
  );

  // DELETE /networks/:id - Remove a network
  app.delete<{ Params: { id: string } }>("/networks/:id", async (request) => {
    await dockerService.removeNetwork(request.params.id);
    return { success: true };
  });

  // GET /images - List all Docker images
  app.get("/images", async () => {
    return dockerService.listImages();
  });

  // DELETE /images/:id - Remove an image
  app.delete<{ Params: { id: string }; Querystring: { force?: string } }>(
    "/images/:id",
    async (request, reply) => {
      const { id } = request.params;

      const containers = await dockerService.listContainers();
      const inUse = containers.some((c) => c.ImageID === id || c.Image === id);
      if (inUse) {
        return reply
          .code(409)
          .send({ error: "Image is in use by a running container" });
      }

      const force = request.query.force === "true";
      await dockerService.removeImage(id, force);
      return { success: true };
    },
  );

  // POST /images/:name/pull - Pull an image
  app.post<{ Params: { name: string } }>(
    "/images/:name/pull",
    async (request) => {
      const { name } = request.params;
      await dockerService.pullImage(name);
      return { success: true, image: name };
    },
  );

  // POST /images/prune - Prune unused images
  app.post("/images/prune", async () => {
    return dockerService.pruneImages();
  });

  // GET /volumes - List Docker volumes with container counts
  app.get<{ Querystring: { page?: string; pageSize?: string } }>(
    "/volumes",
    async (request) => {
      const page = Math.max(1, parseInt(request.query.page ?? "1", 10));
      const pageSize = Math.min(
        50,
        Math.max(1, parseInt(request.query.pageSize ?? "15", 10)),
      );
      return dockerService.listVolumesWithUsage(page, pageSize);
    },
  );

  // POST /volumes - Create a volume
  app.post<{ Body: { name: string; driver?: string } }>(
    "/volumes",
    async (request, reply) => {
      const { name, driver } = request.body;
      if (!name || typeof name !== "string") {
        return reply.code(400).send({ error: "Volume name is required" });
      }
      const volume = await dockerService.createVolume(name, driver);
      return { name: volume.Name };
    },
  );

  // DELETE /volumes/:name - Remove a volume
  app.delete<{ Params: { name: string } }>(
    "/volumes/:name",
    async (request) => {
      await dockerService.removeVolume(request.params.name);
      return { success: true };
    },
  );

  // POST /volumes/prune - Prune unused volumes
  app.post("/volumes/prune", async () => {
    return dockerService.pruneVolumes();
  });
}
