import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { punchInOut } from "../../controllers/performance/attendance.controller.js";

const router = Router();

router.post("/punch", authenticateUser, punchInOut);

export default router;
