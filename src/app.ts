import express from "express";

import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { errorMiddleware } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/request.middleware";
import routes from "./routes/index.js";
import path from "path";
import { createDailyAttendance } from "./services/attendance.service";

const app = express();

app.use(
    cors({
        origin: "*",
        credentials: true,
        exposedHeaders: ["Content-Disposition"],
    })
);

app.use(helmet({
    crossOriginResourcePolicy: false,
}));

app.use(compression());

app.use(express.json());

app.use(
    "/uploads",
    express.static(
        path.join(process.cwd(), "public/uploads")
    )
);

app.use(requestLogger);

app.use("/api", routes);

app.get("/", (_req, res) => {
    res.send("CRM Backend Running");
});

app.use(errorMiddleware);

// createDailyAttendance();
export default app;