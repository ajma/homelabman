import { z } from "zod";
import path from "path";

const configSchema = z.object({
  projectsDir: z.string().default("/data/projects"),
  hostProjectsDir: z
    .string()
    .optional()
    .refine((val) => !val || path.isAbsolute(val), {
      message:
        "HOST_PROJECTS_DIR must be an absolute path. Set DATA_DIR to an absolute host path (e.g. /home/user/labrador/data).",
    }),
  jwtSecret: z.string().default("dev-secret-change-me"),
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  databasePath: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function parseConfig(
  env: Record<string, string | undefined>,
): AppConfig {
  return configSchema.parse({
    projectsDir: env.PROJECTS_DIR,
    hostProjectsDir: env.HOST_PROJECTS_DIR,
    jwtSecret: env.JWT_SECRET,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    databasePath: env.DATABASE_PATH,
  });
}
