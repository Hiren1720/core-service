import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { applyLeave, getLeaveApplicationById, getLeaveApplicationCount, getLeavesApplications, updateLeaveApplicationStatus } from "../../controllers/performance/leaveRequest.controller.js";

const router = Router();

router.post("/", authenticateUser, applyLeave);

router.patch("/status/:leaveRequestId", authenticateUser, updateLeaveApplicationStatus);

router.get("/", authenticateUser, getLeavesApplications);

router.get("/count", authenticateUser, getLeaveApplicationCount);

router.get("/:leaveRequestId", authenticateUser, getLeaveApplicationById);

export default router;
