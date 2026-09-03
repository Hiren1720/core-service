import { Router } from "express";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { getOverallExpensesCount } from "../../controllers/expense/overall.controller.js";
import { workforceOverview } from "../../controllers/dashboard/dashboard.controller.js";
import { getBranchShiftDepartmentList, getEmployeeList } from "../../controllers/admin/company/dashboard.controller.js";

const router = Router();

router.get("/expense", authenticateAdmin, getOverallExpensesCount);

router.get("/workforce", authenticateAdmin, workforceOverview);

router.get("/employee", authenticateAdmin, getEmployeeList);

router.get("/branch-shift-department", authenticateAdmin, getBranchShiftDepartmentList);

export default router;
