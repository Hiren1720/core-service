import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { invoicePayments } from "../../controllers/admin/payments/payments.controller.js";

const router = Router();

router.get(
    "/list",
    // authenticateAdmin,
    invoicePayments
);

export default router;