import app from "./app";
import { env } from "./config/env";
import { logger } from "./infrastructure/logger/logger";
import { connectMongo } from "./infrastructure/database/mongoose";
import { registerAttendanceScheduler } from "./lib/bullmq/schedulers/attendance.scheduler";

async function bootstrap() {
  // Critical dependency
  await connectMongo();

  // Start API immediately
  app.listen(env.PORT, () => {
    logger.info(`Server started on ${env.PORT}`);
  });

  // Non-critical dependency
  try {
    await registerAttendanceScheduler();

    logger.info("BullMQ initialized");
  } catch (error) {
    logger.error({ error }, "BullMQ unavailable. API will continue.");
  }
}

bootstrap();
