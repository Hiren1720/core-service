import { connectMongo } from "./infrastructure/database/mongoose";

async function startWorkers() {
  try {
    console.log("Worker server starting...");

    await connectMongo();
    console.log("✅ MongoDB Connected");

    const attendanceWorkerPath = "./lib/bullmq/workers/attendance.worker.js";
    const invoiceWorkerPath = "./lib/bullmq/workers/invoice.worker.js";
    const payrollWorkerPath = "./lib/bullmq/workers/payroll.worker.js";
    const leaveWorkerPath = "./lib/bullmq/workers/leave.worker.js";
    
    await import(attendanceWorkerPath);
    await import(invoiceWorkerPath);
    await import(payrollWorkerPath);
    await import(leaveWorkerPath);

    console.log("✅ Workers started");
  } catch (error) {
    console.error("❌ Worker startup failed:", error);
    process.exit(1);
  }
}

startWorkers();