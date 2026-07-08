import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createDeduction,
  getDeduction,
  updateDeduction,
} from "../../controllers/payslip/deduction.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createDeduction);

router.get("/", authenticateUser, getDeduction);

router.put("/", authenticateUser, authorize("OWNER"), updateDeduction);

export default router;
