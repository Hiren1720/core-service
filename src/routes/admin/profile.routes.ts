import { Router } from "express";

import { getProfile, updateProfile } from "../../controllers/admin/profile/profile.controller.js";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

router.get(
    "/",
    authenticateAdmin,
    getProfile
);

router.put(
    "/",
    authenticateAdmin,
    upload.fields([{ name: "profileImage", maxCount: 1 }, { name: "companyLogo", maxCount: 1 }]),
    updateProfile
);

export default router;