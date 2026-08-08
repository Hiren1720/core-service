import { Router } from "express";
import AttendanceRoutes from "./attendance.routes";
import LeaveRequestRoutes from "./leaveRequest.routes";

const router = Router();

router.use(
  "/attendance",
  AttendanceRoutes
);

router.use(
  "/leave-request",
  LeaveRequestRoutes
);

export default router;