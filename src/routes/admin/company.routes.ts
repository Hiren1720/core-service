import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
import { createCompany, getCompanies, getCompaniesCount, getCompanyById, updateCompany } from "../../controllers/admin/company/company.controller.js";
import dashboardRoutes from "./dashboard.routes.js";

const router = Router();

router.use("/dashboard", dashboardRoutes);

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

router.get(
    "/:companyId",
    authenticateAdmin,
    getCompanyById
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

router.put(
    "/:companyId",
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
    updateCompany
);

export default router;