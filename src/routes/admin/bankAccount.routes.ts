import { Router } from "express";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { createBankAccount, getBankAccounts, updateBankAccountStatus } from "../../controllers/admin/profile/bankAccount.controller.js";

const router = Router();

router.post(
    "/add",
    authenticateAdmin,
    createBankAccount
);

router.get(
    "/list",
    authenticateAdmin,
    getBankAccounts
);

router.put(
    "/status/:id",
    authenticateAdmin,
    updateBankAccountStatus
);

export default router;