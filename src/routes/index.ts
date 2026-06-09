import { Router } from "express";
import AdminAuthRoutes from "./admin/auth.routes.js";
import AdminProfileRoutes from "./admin/profile.routes.js";
import AdminCompanyRoutes from "./admin/company.routes.js";
const router = Router();

router.use(
  "/admin/auth",
  AdminAuthRoutes
);

router.use(
  "/admin/profile",
  AdminProfileRoutes
);

router.use(
  "/admin/companies",
  AdminCompanyRoutes
)
export default router;