import { Router } from "express";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { changePassword, createAdmin, login } from "../../controllers/admin/auth/auth.controller.js";

const router = Router();

router.post(
    "/add",
    createAdmin
);

router.post(
    "/login",
    login
);

router.post(
    "/change-password",
    authenticateAdmin,
    changePassword
);

export default router;