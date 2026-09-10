import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { addInvoicePayment, getYearwisePaymentsList, invoicePayments } from "../../controllers/admin/payments/payments.controller.js";

const router = Router();

router.get(
    "/list",
    authenticateAdmin,
    invoicePayments
);

router.post(
    "/add/:invoiceId",
    authenticateAdmin,
    addInvoicePayment
)

router.get(
    "/yearly/list",
    authenticateAdmin,
    getYearwisePaymentsList
)

export default router;