// jobs/attendance.daily.job.ts

import cron from "node-cron";
import { attendanceQueue } from "../lib/bullmq/queue";

cron.schedule("0 4 * * *", async () => {
  await attendanceQueue.add(
    "createAttendance",
    {},
    {
        attempts:5,

        backoff:{
            type:"exponential",
            delay:5000
        }
    }
);

  console.log("Attendance job queued");
});