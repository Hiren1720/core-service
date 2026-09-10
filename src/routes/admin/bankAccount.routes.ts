import { Router } from "express";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { createBankAccount, getBankAccounts, updateBankAccount } from "../../controllers/admin/profile/bankAccount.controller.js";

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
    "/:id",
    authenticateAdmin,
    updateBankAccount
);

export default router;