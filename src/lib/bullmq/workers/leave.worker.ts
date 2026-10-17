import { Worker } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";
import { autoRejectPendingLeaveRequests } from "../../../services/autoRejectPendingLeaveRequests.service";

export const leaveWorker = new Worker(
  "leave",
  async (job) => {
    switch (job.name) {
      case "autoRejectPendingLeaves":
        await autoRejectPendingLeaveRequests({
          year: job.data.year,
          month: job.data.month,
        });
        break;
      default:
        throw new Error(`Unknown leave job: ${job.name}`);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

leaveWorker.on("completed", (job) => {
  console.log(`Leave job completed: ${job.id}`);
});

leaveWorker.on("failed", (job, error) => {
  console.error(`Leave job failed: ${job?.id}`, error);
});

leaveWorker.on("error", (error) => {
  console.error("Leave worker error:", error);
});