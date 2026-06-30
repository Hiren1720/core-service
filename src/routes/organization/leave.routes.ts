import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createLeave,
  getLeaveById,
  getLeaves,
  updateLeave,
  updateLeaveStatus,
} from "../../controllers/organization/leave.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createLeave);

router.get("/", authenticateUser, getLeaves);

router.get("/:leaveId", authenticateUser, getLeaveById);

router.put("/:leaveId", authenticateUser, authorize("OWNER"), updateLeave);

router.patch(
  "/status/:leaveId",
  authenticateUser,
  authorize("OWNER"),
  updateLeaveStatus,
);

export default router;
