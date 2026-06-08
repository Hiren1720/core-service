import mongoose from "mongoose";

import { env } from "../../config/env";
import { logger } from "../../infrastructure/logger/logger";

export async function connectMongo() {
  await mongoose.connect(
    env.MONGODB_URI
  );

  logger.info(
    "MongoDB connected"
  );
}