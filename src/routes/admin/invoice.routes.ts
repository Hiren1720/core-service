import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { upload } from "../../middleware/upload.middleware.js";
import { getCompanyEmployeeStatusHistory, getInvoiceDetails, getInvoiceList, sendInvoice } from "../../controllers/admin/invoice/invoice.controller.js";

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

router.post(
    "/:invoiceId/send",
    authenticateAdmin,
    upload.single("invoicePdf"),
    sendInvoice,
);

router.get(
    "/:invoiceId",
    authenticateAdmin,
    getInvoiceDetails
)

export default router;