import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { applyLeave, updateLeaveApplicationStatus } from "../../controllers/performance/leaveRequest.cotroller.js";

const router = Router();

router.post("/", authenticateUser, applyLeave);

router.patch("/status/:leaveRequestId", authenticateUser, updateLeaveApplicationStatus);

// router.get("/:id", authenticateUser, getAttendanceByDate);

export default router;
