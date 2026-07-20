import { Router } from "express";
import ReimbursementRoutes from "./reimbursement.routes";
import OfficeExpenseRoutes from "./officeExpense.routes";

const router = Router();

router.use(
  "/reimbursements",
  ReimbursementRoutes
);

router.use(
  "/officeExpense",
  OfficeExpenseRoutes
);

export default router;