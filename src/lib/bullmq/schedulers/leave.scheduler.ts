import { leaveQueue } from "../queues/leave.queue";

export const registerMonthlyLeaveAutoRejectScheduler = async ({
  year,
  month,
}: {
  year: number;
  month: number;
}) => {
  await leaveQueue.add(
    "autoRejectPendingLeaves",
    { year, month },
    { jobId: `leave-auto-reject-${year}-${month}` },
  );

  console.log(`Leave auto-rejection job queued for ${year}-${month}`);
};