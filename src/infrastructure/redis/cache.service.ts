import { redis }
from "./redis.client.js";

export class CacheService {

  async get<T>(
    key: string
  ): Promise<T | null> {

    const value =
      await redis.get(key);

    return value
      ? JSON.parse(value)
      : null;
  }

  async set(
    key: string,
    value: unknown,
    ttl?: number
  ) {
    if (ttl) {
      await redis.set(
        key,
        JSON.stringify(value),
        "EX",
        ttl
      );
      return;
    }

    await redis.set(
      key,
      JSON.stringify(value)
    );
  }

  async delete(
    key: string
  ) {
    await redis.del(key);
  }
}