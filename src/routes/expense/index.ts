import { Router } from "express";
import ReimbursementRoutes from "./reimbursement.routes";

const router = Router();

router.use(
  "/reimbursements",
  ReimbursementRoutes
);

export default router;