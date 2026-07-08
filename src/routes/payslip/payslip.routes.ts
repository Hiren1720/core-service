import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createPayslip,
  getPayslipById,
  getPayslips,
  getPayslipsCount,
  updatePayslip,
  updatePayslipStatus,
} from "../../controllers/payslip/payslip.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createPayslip);

router.get("/", authenticateUser, getPayslips);

router.get("/count", authenticateUser, getPayslipsCount);

router.get("/:payslipId", authenticateUser, getPayslipById);

router.put("/:payslipId", authenticateUser, authorize("OWNER"), updatePayslip);

router.patch(
  "/status/:payslipId",
  authenticateUser,
  authorize("OWNER"),
  updatePayslipStatus,
);

export default router;
