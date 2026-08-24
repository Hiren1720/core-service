import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";

import { upload } from "../../middleware/upload.middleware.js";
import {
  editUserDetail,
  getEmployeeById,
  getEmployeeCount,
  getEmployeeList,
  getEmployeeSalaryDetails,
  myManagedEmployeeList,
  updateEmployeeSalary,
} from "../../controllers/workforce/employee.controller.js";

const router = Router();

router.get("/my-managed", authenticateUser, myManagedEmployeeList);

router.put(
  "/:userId",
  authenticateUser,
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
  ]),
  editUserDetail,
);

router.get("/", authenticateUser, getEmployeeList);

router.get("/count", authenticateUser, getEmployeeCount);

router.get("/salary", authenticateUser, getEmployeeSalaryDetails);

router.post("/salary", authenticateUser, updateEmployeeSalary);

router.get("/:userId", authenticateUser, getEmployeeById)

export default router;
