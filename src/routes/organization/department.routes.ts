import { Router } from "express";

import {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    updateDepartmentStatus,
    getBranchShiftOptions,
} from "../../controllers/organization/department.controller";

import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

router.get(
    "/branch-shift-options",
    authenticateUser,
    getBranchShiftOptions
);

router.post(
    "/",
    authenticateUser,
    authorize("OWNER"),
    createDepartment
);

router.get(
    "/",
    authenticateUser,
    getDepartments
);

router.get(
    "/:departmentId",
    authenticateUser,
    getDepartmentById
);

router.put(
    "/:departmentId",
    authenticateUser,
    authorize("OWNER"),
    updateDepartment
);

router.patch(
    "/status/:departmentId",
    authenticateUser,
    authorize("OWNER"),
    updateDepartmentStatus
);

export default router;