import app from "./app";
import { env } from "./config/env";
import { logger } from "./infrastructure/logger/logger";
import { connectMongo } from "./infrastructure/database/mongoose";
import { registerSchedulers } from "./lib/bullmq/schedulers/registerScheduler";

async function bootstrap() {
  await connectMongo();

  registerSchedulers();

  app.listen(env.PORT, () => {
    logger.info(`Server started on ${env.PORT}`);
  });
}

bootstrap();
