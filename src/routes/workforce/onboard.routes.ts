import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createEmployee,
  getEmployeeCount,
  getEmployeeList,
} from "../../controllers/workforce/onboard.controller.js";
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

router.post(
  "/",
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "documents",
      maxCount: 10,
    },
    {
      name: "educations",
      maxCount: 10,
    },
    {
      name: "experiences",
      maxCount: 10,
    },
  ]),
  createEmployee,
);

router.put(
  "/:userId",
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "documents",
      maxCount: 10,
    },
    {
      name: "educations",
      maxCount: 10,
    },
    {
      name: "experiences",
      maxCount: 10,
    },
  ]),
  //   updateEmployeeProfile,
);

// router.get(
//     "//:userId",
//     getEmployeeDetail
// );

router.get("/", authenticateUser, getEmployeeList);

router.get("/count", authenticateUser, getEmployeeCount);

export default router;
