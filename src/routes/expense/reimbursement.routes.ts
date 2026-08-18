import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createReimbursement,
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
  authorize("OWNER", "EMPLOYEE"),
  createReimbursement,
);

router.get("/", authenticateUser, getReimbursements);

router.get("/count", authenticateUser, getReimbursementsCount);

router.get("/:reimbursementId", authenticateUser, getReimbursementById);

router.patch(
  "/status/:reimbursementId",
  authenticateUser,
  authorize("OWNER"),
  updateReimbursementStatus,
);

export default router;
