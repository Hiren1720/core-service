import express from "express";

import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { errorMiddleware } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/request.middleware";

const app = express();

app.use(cors());

app.use(helmet());

app.use(compression());

app.use(express.json());

app.use(requestLogger);

app.use(errorMiddleware);

export default app;