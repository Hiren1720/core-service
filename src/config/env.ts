import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum([
    "development",
    "production",
    "test"
  ]),

  PORT: z.coerce.number(),

  MONGODB_URI: z.string(),

  REDIS_HOST: z.string(),

  REDIS_PORT: z.coerce.number(),

  JWT_ACCESS_SECRET: z.string(),

  JWT_REFRESH_SECRET: z.string()
});

export const env =
  envSchema.parse(process.env);