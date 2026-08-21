import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware";
import { getUserAssignmentHistory, getUserHistoryByType } from "../../controllers/history/userHistoory.controller";

const router = Router();

router.get("/", authenticateUser, getUserHistoryByType);

router.get("/assignments", authenticateUser, getUserAssignmentHistory);

export default router;