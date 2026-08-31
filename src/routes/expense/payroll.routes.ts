import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { getEmployeeWiseYearlyPayrolls, getPayrolls } from "../../controllers/expense/payroll.controller.js";

const router = Router();

router.get("/", authenticateUser, getPayrolls);

router.get("/payslips", authenticateUser, getEmployeeWiseYearlyPayrolls);

export default router;
