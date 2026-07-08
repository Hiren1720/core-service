import { Router } from "express";
import PayslipRoutes from "./payslip.routes";
import DeductionRoutes from "./deduction.routes";

const router = Router();

router.use(
  "/earnings",
  PayslipRoutes
);

router.use(
  "/deductions",
  DeductionRoutes
);

export default router;