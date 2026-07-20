import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createTermination,
  getTerminationById,
  getTerminations,
  getTerminationCount,
  updateTermination,
  updateTerminationStatus,
} from "../../controllers/workforce/termination.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createTermination);

router.get("/", authenticateUser, getTerminations);

router.get("/count", authenticateUser, getTerminationCount);

router.get("/:terminationId", authenticateUser, getTerminationById);

router.put(
  "/:terminationId",
  authenticateUser,
  authorize("OWNER"),
  updateTermination,
);

router.patch(
  "/status/:terminationId",
  authenticateUser,
  authorize("OWNER"),
  updateTerminationStatus,
);

export default router;
