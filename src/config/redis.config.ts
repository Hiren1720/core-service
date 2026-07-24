import IORedis from "ioredis";
import { env } from "./env";

let redis: IORedis | null = null;

export const getRedisConnection = () => {
  if (!redis) {
    redis = new IORedis({
      host: env.REDIS_HOST,
      port: Number(env.REDIS_PORT),
      password: env.REDIS_PASSWORD || undefined,

      maxRetriesPerRequest: null,

      retryStrategy(times) {
        if (times > 3) {
          console.error("❌ Redis unavailable");
          return null;
        }

        return 2000;
      },
    });

    redis.on("connect", () => {
      console.log("✅ Redis Connected");
    });

    redis.on("error", (err) => {
      console.log("Redis Error:", err.message);
    });
  }

  return redis;
};