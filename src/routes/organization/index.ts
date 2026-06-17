import { Router } from "express";
import BranchRoutes from "./branch.routes";
import ShiftRoutes from "./shift.routes";

const router = Router();

router.use(
  "/branches",
  BranchRoutes
);

router.use(
  "/shifts",
  ShiftRoutes
);


export default router;