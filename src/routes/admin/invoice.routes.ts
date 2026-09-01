import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { getCompanyEmployeeStatusHistory, getInvoiceDetails, getInvoiceList } from "../../controllers/admin/invoice/invoice.controller.js";

const router = Router();

router.get(
    "/list",
    authenticateAdmin,
    getInvoiceList
);

router.get(
    "/employee-status-history",
    authenticateAdmin,
    getCompanyEmployeeStatusHistory
)

router.get(
    "/:invoiceId",
    authenticateAdmin,
    getInvoiceDetails
)

export default router;