import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { getPayrolls } from "../../controllers/expense/payroll.controller.js";

const router = Router();

router.get("/", authenticateUser, getPayrolls);

export default router;
