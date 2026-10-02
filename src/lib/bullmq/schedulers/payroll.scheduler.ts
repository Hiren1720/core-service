import { payrollQueue } from "../queues/payroll.queue";

export const registerMonthlyPayrollScheduler = async () => {
  const now = new Date();

  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const year = previousMonth.getFullYear();
  const month = previousMonth.getMonth() + 1;

  await payrollQueue.add(
    "generatePreviousMonthPayroll",
    {
      year,
      month,
    },
    {
      jobId: `payroll-monthly-${year}-${month}`,
    },
  );

  console.log(`payroll job queued for ${year}-${month}`);
};