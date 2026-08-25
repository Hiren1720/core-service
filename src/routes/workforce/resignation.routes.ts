import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createResignation,
  getResignationById,
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
  authorize("MANAGER", "EMPLOYEE"),
  createResignation,
);

router.get("/", authenticateUser, getResignations);

router.get("/count", authenticateUser, getResignationCount);

router.get("/:resignationId", authenticateUser, getResignationById);

router.put(
  "/:resignationId",
  authenticateUser,
  authorize("MANAGER", "EMPLOYEE"),
  updateResignation,
);

router.patch(
  "/status/:resignationId",
  authenticateUser,
  authorize("OWNER", "MANAGER"),
  updateResignationStatus,
);

router.post(
  "/send-mail",
  authenticateUser,
  authorize("OWNER", "MANAGER"),
  sendResignationAcceptedMail,
);

export default router;
