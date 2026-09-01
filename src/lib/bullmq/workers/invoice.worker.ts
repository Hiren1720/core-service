import { Worker } from "bullmq";
import { getRedisConnection } from "../../../config/redis.config";
import { generatePreviousMonthInvoice } from "../../../services/invoice.service";


export const monthlyWorker = new Worker(
  "monthly",
  async (job) => {
    switch (job.name) {
      case "generatePreviousMonthInvoice":
        await generatePreviousMonthInvoice({
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