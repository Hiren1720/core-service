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
} from "../../controllers/workforce/promotion.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createPromotion);

router.get("/", authenticateUser, getPromotions);

router.get("/count", authenticateUser, getPromotionCount);

router.get("/:promotionId", authenticateUser, getPromotionById);

router.put(
  "/:promotionId",
  authenticateUser,
  authorize("OWNER"),
  updatePromotion,
);

router.patch(
  "/status/:promotionId",
  authenticateUser,
  authorize("OWNER"),
  updatePromotionStatus,
);

export default router;
