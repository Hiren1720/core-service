import { Router } from "express";
import {
  attendanceOverview,
  getProfileCardDetails,
  myLeaveAndManualPunch,
  workforceOverview,
} from "../../controllers/dashboard/dashboard.controller.js";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

router.get("/workforce", authenticateUser, workforceOverview);

router.get("/attendance", authenticateUser, attendanceOverview);

router.get("/profile", authenticateUser, getProfileCardDetails);

router.get(
  "/leaves&manual",
  authenticateUser,
  authorize("EMPLOYEE"),
  myLeaveAndManualPunch,
);

export default router;
