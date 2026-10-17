import { Queue } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";

export const leaveQueue = new Queue("leave", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

leaveQueue.on("error", (error) => {
  console.error("Leave queue error:", error);
});