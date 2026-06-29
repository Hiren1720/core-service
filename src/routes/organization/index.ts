import { Router } from "express";
import BranchRoutes from "./branch.routes";
import ShiftRoutes from "./shift.routes";
import DepartmentRoutes from "./department.routes";
import DesignationRoutes from "./designation.routes";

const router = Router();

router.use(
  "/branches",
  BranchRoutes
);

router.use(
  "/shifts",
  ShiftRoutes
);

router.use(
  "/departments",
  DepartmentRoutes
);

router.use(
  "/designations",
  DesignationRoutes
);

export default router;