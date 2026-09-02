import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import {
  getAttendanceByDate,
  getAttendanceCountByDate,
  getManualPunchList,
  rejectAttendance,
} from "../../controllers/performance/attendance.controller.js";
import {
  getAttendanceByMonth,
  getAttendanceCountByMonth,
  getMyTodayStatus,
  manualPunch,
  punchIn,
  punchOut,
} from "../../controllers/performance/myAttendance.controller.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

router.post("/punch/in", authenticateUser, punchIn);

router.post("/punch/out", authenticateUser, punchOut);

router.post("/punch/manual", authenticateUser, manualPunch);

router.get("/punch/manual/list", authenticateUser, getManualPunchList);

router.get("/my/status", authenticateUser, getMyTodayStatus);

router.get("/my/monthly", authenticateUser, getAttendanceByMonth);

router.get("/my/monthly/count", authenticateUser, getAttendanceCountByMonth);

router.get("/daily", authenticateUser, getAttendanceByDate);

router.get("/daily/count", authenticateUser, getAttendanceCountByDate);

router.put(
  "/punch/reject/:attendanceId",
  authenticateUser,
  authorize("MANAGER", "OWNER"),
  rejectAttendance,
);

export default router;
