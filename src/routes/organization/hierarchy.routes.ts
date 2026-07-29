import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware";
import { getDepartmentEmployeeList } from "../../controllers/organization/hierarchy.controller";

const router = Router();

router.get("/employee", authenticateUser, getDepartmentEmployeeList);

export default router;