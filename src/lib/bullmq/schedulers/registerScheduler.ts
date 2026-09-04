import cron from "node-cron";

import {
  registerAttendanceAutoCloseScheduler,
  registerAttendanceScheduler,
} from "./attendance.scheduler";

import { registerMonthlyInvoiceScheduler } from "./invoice.scheduler";

export const registerSchedulers = () => {
  // Daily attendance at 00:59 AM IST
  cron.schedule(
    "59 0 * * *",
    async () => {
      // await registerAttendanceScheduler();
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

   cron.schedule(
    "* * * * *",
    async () => {
      await registerAttendanceScheduler();
      console.log("Running a task every minute");
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  // Auto close at 11:45 PM IST
  cron.schedule(
    "45 23 * * *",
    async () => {
      // await registerAttendanceAutoCloseScheduler();
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  // Monthly snapshot + invoice
  // 1st day of every month at 1:00 AM IST
  cron.schedule(
    "0 1 1 * *",
    async () => {
      // await registerMonthlyInvoiceScheduler();
    },
    {
      timezone: "Asia/Kolkata",
    },
  );
};