// workers/attendance.worker.ts

import { Worker } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";
import { createDailyAttendance } from "../../../services/attendance.service";

new Worker(
  "attendance",
  async (job) => {
    switch (job.name) {
      case "createDailyAttendance":
        await createDailyAttendance();
        break;
    }
  },
  {
    connection: getRedisConnection(),
  },
);
