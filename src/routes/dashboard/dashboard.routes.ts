import { Router } from "express";
import { attendanceOverview, getProfileCardDetails, workforceOverview } from "../../controllers/dashboard/dashboard.controller.js";
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

router.get(
  "/profile",
  authenticateUser,
  getProfileCardDetails
);

export default router;