import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createResignation,
  getResignationByUserId,
  getResignations,
  getResignationCount,
  updateResignation,
  updateResignationStatus,
  sendResignationAcceptedMail,
} from "../../controllers/workforce/resignation.controller.js";

const router = Router();

router.post(
  "/",
  authenticateUser,
  createResignation,
);

router.get("/", authenticateUser,  authorize("OWNER", "EMPLOYEE"), getResignations);

router.get("/count", authenticateUser, getResignationCount);

router.get("/:userId", authenticateUser, getResignationByUserId);

router.put(
  "/:resignationId",
  authenticateUser,
  authorize("MANAGER", "EMPLOYEE"),
  updateResignation,
);

router.patch(
  "/status/:resignationId",
  authenticateUser,
  updateResignationStatus,
);

router.post(
  "/send-mail",
  authenticateUser,
  authorize("OWNER", "MANAGER"),
  sendResignationAcceptedMail,
);

export default router;
