import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
import { createCompany, getCompanies, getCompaniesCount } from "../../controllers/admin/company/company.controller.js";

const router = Router();

router.get(
    "/list",
    authenticateAdmin,
    getCompanies
);

router.get(
    "/count",
    authenticateAdmin,
    getCompaniesCount
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