import { Router } from "express";

import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { getInvoiceList } from "../../controllers/admin/invoice/invoice.controller.js";

const router = Router();

router.get(
    "/list",
    // authenticateAdmin,
    getInvoiceList
);

export default router;