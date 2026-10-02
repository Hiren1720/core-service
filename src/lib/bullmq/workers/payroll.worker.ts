import { Worker } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";
import { generateCompanyPayroll } from "../../../services/payroll.service";

export const payrollWorker = new Worker(
  "monthly",
  async (job) => {
    switch (job.name) {
      case "generatePreviousMonthPayroll":
        await generateCompanyPayroll({
          year: job.data.year,
          month: job.data.month,
        });
        break;

      default:
        throw new Error(`Unknown monthly job: ${job.name}`);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);
