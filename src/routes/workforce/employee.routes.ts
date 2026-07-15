import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";

import { upload } from "../../middleware/upload.middleware.js";
import { editUserDetail } from "../../controllers/workforce/employee.controller.js";

const router = Router();

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


export default router;
