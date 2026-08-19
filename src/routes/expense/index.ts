import { Router } from "express";
import OverallExpenseRoutes from "./overall.routes";
import ReimbursementRoutes from "./reimbursement.routes";
import OfficeExpenseRoutes from "./officeExpense.routes";
import PayRollRoutes from "./payroll.routes";

const router = Router();

router.use(
  "/overall",
  OverallExpenseRoutes
);

router.use(
  "/reimbursements",
  ReimbursementRoutes
);

router.use(
  "/officeExpense",
  OfficeExpenseRoutes
);

router.use(
  "/payroll",
  PayRollRoutes
);


export default router;