import { Queue } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";

export const attendanceQueue = new Queue("attendance", {
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

attendanceQueue.on("error", (error) => {
  console.error("Attendance queue error:", error);
});