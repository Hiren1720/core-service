import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import {
  assignRolesResponsibility,
  createEmployee,
  getBranchShiftDepartmentList,
  getEmployDetailById,
  getEmployeeCount,
  getEmployeeList,
  getOnboardCompanyInfo,
  updateUserStatus,
} from "../../controllers/workforce/onboard.controller.js";
import { upload } from "../../middleware/upload.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();

router.post(
  "/",
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    { name: "documents[0][front]", maxCount: 1 },
    { name: "documents[0][back]", maxCount: 1 },
    { name: "documents[1][front]", maxCount: 1 },
    { name: "documents[1][back]", maxCount: 1 },
    { name: "documents[2][front]", maxCount: 1 },
    { name: "documents[2][back]", maxCount: 1 },
    { name: "educations[0][document]", maxCount: 1 },
    { name: "educations[0][document]", maxCount: 1 },
    { name: "educations[1][document]", maxCount: 1 },
    { name: "educations[1][document]", maxCount: 1 },
    { name: "educations[2][document]", maxCount: 1 },
    { name: "educations[2][document]", maxCount: 1 },
    { name: "experiences[0][document]", maxCount: 1 },
    { name: "experiences[0][document]", maxCount: 1 },
    { name: "experiences[1][document]", maxCount: 1 },
    { name: "experiences[1][document]", maxCount: 1 },
    { name: "experiences[2][document]", maxCount: 1 },
    { name: "experiences[2][document]", maxCount: 1 },
  ]),
  createEmployee,
);

router.get("/", authenticateUser, getEmployeeList);

router.get("/count", authenticateUser, getEmployeeCount);

router.get("/company-info/:companyId", getOnboardCompanyInfo);

router.post(
  "/roles-responsibility",
  authenticateUser,
  assignRolesResponsibility,
);

router.get(
  "/branch-shift-department",
  authenticateUser,
  getBranchShiftDepartmentList,
);

router.get("/:userId", getEmployDetailById);

router.patch(
  "/status/:userId",
  authenticateUser,
  authorize("OWNER"),
  updateUserStatus,
);
export default router;
