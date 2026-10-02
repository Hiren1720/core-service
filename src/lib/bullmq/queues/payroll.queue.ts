import { Queue } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";

export const payrollQueue = new Queue("payroll", {
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

payrollQueue.on("error", (error) => {
  console.error("Payroll queue error:", error);
});