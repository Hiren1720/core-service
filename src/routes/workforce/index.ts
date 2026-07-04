import { Router } from "express";
import OnboardRoutes from "./onboard.routes";

const router = Router();

router.use(
  "/onboard",
  OnboardRoutes
);

export default router;