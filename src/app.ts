import express from "express";

import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { errorMiddleware } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/request.middleware";
import routes from "./routes/index.js";
import path from "path";
import { createDailyAttendance } from "./services/attendance.service";
import { generateUserMonthlyPunchTestData } from "./test/generateUserMonthlyPunchTestData";
import { generateEmployeePayroll } from "./services/payroll.service";
import { defaultDeduction } from "./shared/helpers/defaultDeduction";
import { processCompanyDailyAttendance } from "./services/companyAttendance.service";
import { processAutoCloseAttendance } from "./services/autoCloseAttendance.service";

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
    res.send("CRM Backend Running on 5000");
});

app.use(errorMiddleware);

// createDailyAttendance();
// processCompanyDailyAttendance({companyId:"6a312d0ca1023683916a1eaf", attendanceDate: new Date() });
// processAutoCloseAttendance({companyId:"6a312d0ca1023683916a1eaf", attendanceDate: new Date() });
// generateUserMonthlyPunchTestData("6a72f0f95fd6f853a3728612", 8, 2026)
// generateEmployeePayroll("6a72f0f95fd6f853a3728612", 8, 2026)
// defaultDeduction("6a72f0f95fd6f853a3728612")
export default app;