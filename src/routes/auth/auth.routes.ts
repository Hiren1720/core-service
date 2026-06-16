import { Router } from "express";
import { forgotPassword, login, logout, refreshToken, resetPassword } from "../../controllers/auth/auth.controller.js";

const router = Router();

router.post(
  "/login",
  login
);

router.post(
    "/refresh-token",
    refreshToken
);

router.post(
    "/logout",
    logout
);

router.post(
    "/forgot-password",
    forgotPassword
);

router.post(
    "/reset-password",
    resetPassword
);

export default router;