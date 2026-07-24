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

router.post("/", authenticateUser, createResignation);

router.get("/", authenticateUser, getResignations);

router.get("/count", authenticateUser, getResignationCount);

router.get("/:resignationId", authenticateUser, getResignationById);

router.put(
  "/:resignationId",
  authenticateUser,
  // authorize("OWNER"),
  updateResignation,
);

router.patch(
  "/status/:resignationId",
  authenticateUser,
  // authorize("OWNER"),
  updateResignationStatus,
);

router.post("/send-mail", authenticateUser, sendResignationAcceptedMail);

export default router;
