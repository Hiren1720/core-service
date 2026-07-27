import { Router } from "express";
import { workforceOverview } from "../../controllers/dashboard/dashboard.controller.js";
import { authenticateUser } from "../../middleware/user.middleware.js";

const router = Router();

router.get(
  "/workforce",
  authenticateUser,
  workforceOverview
);

export default router;