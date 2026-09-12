import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createOfficeExpense,
  getOfficeExpenseById,
  getOfficeExpenses,
  getOfficeExpensesCount,
  updateOfficeExpenseStatus,
} from "../../controllers/expense/officeExpense.controller.js";
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
  authorize("OWNER", "MANGER"),
  createOfficeExpense,
);

router.get("/", authenticateUser, getOfficeExpenses);

router.get("/count", authenticateUser, getOfficeExpensesCount);

router.get("/:officeExpenseId", authenticateUser, getOfficeExpenseById);

router.patch(
  "/status/:officeExpenseId",
  authenticateUser,
  authorize("OWNER", "MANGER"),
  updateOfficeExpenseStatus,
);

export default router;
