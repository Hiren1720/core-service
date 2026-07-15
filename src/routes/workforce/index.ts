import { Router } from "express";
import OnboardRoutes from "./onboard.routes";
import EmployeeRoutes from "./employee.routes";

const router = Router();

router.use(
  "/onboard",
  OnboardRoutes
);

router.use(
  "/employee",
  EmployeeRoutes
);

export default router;