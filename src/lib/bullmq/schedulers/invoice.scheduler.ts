import { invoiceQueue } from "../queues/invoice.queue";

export const registerMonthlyInvoiceScheduler = async () => {
  const now = new Date();

  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const year = previousMonth.getFullYear();
  const month = previousMonth.getMonth() + 1;

  await invoiceQueue.add(
    "generatePreviousMonthInvoice",
    {
      year,
      month,
    },
    {
      jobId: `invoice-monthly-${year}-${month}`,
    },
  );

  console.log(`Monthly job queued for ${year}-${month}`);
};