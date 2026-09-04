import { connectMongo } from "./infrastructure/database/mongoose";

async function startWorkers() {
  try {
    console.log("Worker server starting...");

    await connectMongo();
    console.log("✅ MongoDB Connected");

    const attendanceWorkerPath = "./lib/bullmq/workers/attendance.worker";
    const invoiceWorkerPath = "./lib/bullmq/workers/invoice.worker";
    await import(attendanceWorkerPath);
    await import(invoiceWorkerPath);

    console.log("✅ Workers started");
  } catch (error) {
    console.error("❌ Worker startup failed:", error);
    process.exit(1);
  }
}

startWorkers();