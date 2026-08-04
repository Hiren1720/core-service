import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware";
import { getDepartmentEmployeeList, getBranchShiftDepartmentList } from "../../controllers/organization/hierarchy.controller";

const router = Router();

router.get("/employee", authenticateUser, getDepartmentEmployeeList);

router.get("/company", authenticateUser, getBranchShiftDepartmentList);

export default router;