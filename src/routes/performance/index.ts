import { Router } from "express";
import AttendanceRoutes from "./attendance.routes";

const router = Router();

router.use(
  "/attendance",
  AttendanceRoutes
);

export default router;