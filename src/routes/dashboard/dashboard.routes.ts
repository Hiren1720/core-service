import { Router } from "express";
import { attendanceOverview, workforceOverview } from "../../controllers/dashboard/dashboard.controller.js";
import { authenticateUser } from "../../middleware/user.middleware.js";

const router = Router();

router.get(
  "/workforce",
  authenticateUser,
  workforceOverview
);

router.get(
  "/attendance",
  authenticateUser,
  attendanceOverview
);

export default router;