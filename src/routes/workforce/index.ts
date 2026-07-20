import { Router } from "express";
import OnboardRoutes from "./onboard.routes";
import EmployeeRoutes from "./employee.routes";
import PromotionRoutes from "./promotion.routes";

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

export default router;