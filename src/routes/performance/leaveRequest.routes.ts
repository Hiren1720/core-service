import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { applyLeave, getLeaveApplicationById, getLeaveApplicationCount, getLeavesApplications, getMyLeavesBucket, updateLeaveApplicationStatus, deleteLeaveRequest } from "../../controllers/performance/leaveRequest.controller.js";

const router = Router();

router.get("/bucket", authenticateUser, getMyLeavesBucket);

router.post("/", authenticateUser, applyLeave);

router.patch("/status/:leaveRequestId", authenticateUser, updateLeaveApplicationStatus);

router.delete("/:leaveRequestId", authenticateUser, deleteLeaveRequest);

router.get("/", authenticateUser, getLeavesApplications);

router.get("/count", authenticateUser, getLeaveApplicationCount);

router.get("/:leaveRequestId", authenticateUser, getLeaveApplicationById);

export default router;
