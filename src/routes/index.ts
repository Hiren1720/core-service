import { Router } from "express";
import AdminAuthRoutes from "./admin/auth.routes.js";
import AdminProfileRoutes from "./admin/profile.routes.js";
import AdminCompanyRoutes from "./admin/company.routes.js";
import AdminBankAccountRoutes from "./admin/bankAccount.routes.js";

import AuthRoutes from "./auth/auth.routes.js";
import OrganizationRoutes from "./organization";
import WorkforceRoutes from "./workforce";
import ExpenseRoutes from "./expense";
import PayslipRoutes from "./payslip";
import PerformanceRoutes from "./performance";

import DashboardRoutes from "./dashboard/dashboard.routes.js";

const router = Router();

router.use("/admin/auth", AdminAuthRoutes);

router.use("/admin/profile", AdminProfileRoutes);

router.use("/admin/companies", AdminCompanyRoutes);

router.use("/admin/bank-accounts", AdminBankAccountRoutes);

router.use("/dashboard", DashboardRoutes);

router.use("/auth", AuthRoutes);

router.use("/organization", OrganizationRoutes);

router.use("/workforce", WorkforceRoutes);

router.use("/expense", ExpenseRoutes);

router.use("/payslip", PayslipRoutes);

router.use("/performance", PerformanceRoutes);

export default router;
