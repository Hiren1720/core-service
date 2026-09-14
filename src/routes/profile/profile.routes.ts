import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { updateCompanyDetail } from "../../controllers/profile/profile.controller.js";
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

router.put(
  "/company",
  authenticateUser,
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "companyLogo",
      maxCount: 1,
    },
  ]),
  authorize("OWNER"),
  updateCompanyDetail,
);

export default router;
