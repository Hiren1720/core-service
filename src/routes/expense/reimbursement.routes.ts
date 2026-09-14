import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createReimbursement,
  deleteReimursement,
  getReimbursementById,
  getReimbursements,
  getReimbursementsCount,
  updateReimbursementStatus,
} from "../../controllers/expense/reimbursement.controller.js";
import { upload } from "../../middleware/upload.middleware.js";

const router = Router();

router.post(
  "/",
  upload.fields([
    {
      name: "documents",
      maxCount: 4,
    },
  ]),
  authenticateUser,
  createReimbursement,
);

router.get(
  "/",
  authenticateUser,
  getReimbursements,
);

router.get(
  "/count",
  authenticateUser,
  getReimbursementsCount,
);

router.get(
  "/:reimbursementId",
  authenticateUser,
  getReimbursementById,
);

router.delete(
  "/:reimbursementId",
  authenticateUser,
  deleteReimursement,
);

router.patch(
  "/status/:reimbursementId",
  authenticateUser,
  authorize("OWNER", "MANAGER"),
  updateReimbursementStatus,
);

export default router;
