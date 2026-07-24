import { Queue } from "bullmq";
import { getRedisConnection } from "../../config/redis.config";

export const attendanceQueue = new Queue("attendance", {
  connection: getRedisConnection(),
});

// export const payrollQueue = new Queue("payroll", {
//     connection: redisConnection,
// });

// export const notificationQueue = new Queue("notification", {
//     connection: redisConnection,
// });