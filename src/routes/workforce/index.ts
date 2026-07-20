import { Router } from "express";
import OnboardRoutes from "./onboard.routes";
import EmployeeRoutes from "./employee.routes";
import PromotionRoutes from "./promotion.routes";
import TerminationRoutes from "./termination.routes";
import ResignationRoutes from "./resignation.routes";

const router = Router();

router.use(
  "/onboard",
  OnboardRoutes
);

router.use(
  "/employee",
  EmployeeRoutes
);

router.use(
  "/promotion",
  PromotionRoutes
);

router.use(
  "/termination",
  TerminationRoutes
);

router.use(
  "/resignation",
  ResignationRoutes
);

export default router;