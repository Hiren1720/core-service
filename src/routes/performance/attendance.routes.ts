import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import {
  getAttendanceByDate,
  getAttendanceCountByDate,
} from "../../controllers/performance/attendance.controller.js";
import {
  getAttendanceByMonth,
  getAttendanceCountByMonth,
  getMyTodayStatus,
  manualPunch,
  punchIn,
  punchOut,
} from "../../controllers/performance/myAttendance.controller.js";

const router = Router();

router.post("/punch/in", authenticateUser, punchIn);

router.post("/punch/out", authenticateUser, punchOut);

router.post("/punch/manual", authenticateUser, manualPunch);

router.get("/my/status", authenticateUser, getMyTodayStatus);

router.get("/my/monthly", authenticateUser, getAttendanceByMonth);

router.get("/my/monthly/count", authenticateUser, getAttendanceCountByMonth);

router.get("/daily", authenticateUser, getAttendanceByDate);

router.get("/daily/count", authenticateUser, getAttendanceCountByDate);

export default router;
