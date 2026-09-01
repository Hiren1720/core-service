import { Queue } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";

export const invoiceQueue = new Queue("invoice", {
  connection: getRedisConnection(),
});
