import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { getOverallExpensesCount } from "../../controllers/expense/overall.controller.js";

const router = Router();

router.get("/count", authenticateUser, getOverallExpensesCount);

export default router;
