import { Router } from "express";

import { getProfile } from "../../controllers/admin/profile/profile.controller.js";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
import { createCompany } from "../../controllers/admin/company/company.controller.js";

const router = Router();

router.get(
    "/",
    authenticateAdmin,
    getProfile
);

router.post(
    "/",
    authenticateAdmin,
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
    createCompany
);

export default router;