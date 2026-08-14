import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware";
import { getUserHistoryByType } from "../../controllers/history/userHistoory.controller";

const router = Router();

router.get("/", authenticateUser, getUserHistoryByType);

export default router;