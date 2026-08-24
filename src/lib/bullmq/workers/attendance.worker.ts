import { Worker } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";
import { processCompanyDailyAttendance } from "../../../services/companyAttendace.service";

export const attendanceWorker = new Worker(
  "attendance",
  async (job) => {
    switch (job.name) {
      case "createCompanyDailyAttendance":
        await processCompanyDailyAttendance({
          companyId: job.data.companyId,
          attendanceDate: new Date(
            job.data.attendanceDate,
          ),
        });
        break;

      default:
        throw new Error(
          `Unknown attendance job: ${job.name}`,
        );
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

attendanceWorker.on("completed", (job) => {
  console.log(`Attendance job completed: ${job.id}`);
});

attendanceWorker.on("failed", (job, error) => {
  console.error(`Attendance job failed: ${job?.id}`, error);
});

attendanceWorker.on("error", (error) => {
  console.error(
    "Attendance worker error:",
    error,
  );
});
