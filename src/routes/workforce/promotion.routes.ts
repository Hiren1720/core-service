import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createPromotion,
  getPromotionById,
  getPromotions,
  getPromotionCount,
  updatePromotion,
  updatePromotionStatus,
  sendPromotionMail,
} from "../../controllers/workforce/promotion.controller.js";

const router = Router();

router.post("/", authenticateUser, createPromotion);

router.get("/", authenticateUser, getPromotions);

router.get("/count", authenticateUser, getPromotionCount);

router.get("/:promotionId", authenticateUser, getPromotionById);

router.put(
  "/:promotionId",
  authenticateUser,
  // authorize("OWNER"),
  updatePromotion,
);

router.patch(
  "/status/:promotionId",
  authenticateUser,
  // authorize("OWNER"),
  updatePromotionStatus,
);

router.post("/send-mail", authenticateUser, sendPromotionMail);

export default router;
