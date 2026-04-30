import { FastifyRequest, FastifyReply } from "fastify";

export async function requiresDocker(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!(request.server as any).dockerService) {
    reply.code(503).send({ error: "Docker is not available" });
  }
}
