import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { getAttendanceByDate, getAttendanceCountByDate } from "../../controllers/performance/attendance.controller.js";
import { getMyTodayStatus, punchInOut } from "../../controllers/performance/myAttendance.controller.js";

const router = Router();

router.post("/punch", authenticateUser, punchInOut);

router.get("/my/status", authenticateUser, getMyTodayStatus);

router.get("/daily", authenticateUser, getAttendanceByDate);

router.get("/daily/count", authenticateUser, getAttendanceCountByDate);

export default router;
