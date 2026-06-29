import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createDesignation,
  getDesignationById,
  getDesignations,
  updateDesignation,
  updateDesignationStatus,
} from "../../controllers/organization/designation.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createDesignation);

router.get("/", authenticateUser, getDesignations);

router.get("/:designationId", authenticateUser, getDesignationById);

router.put(
  "/:designationId",
  authenticateUser,
  authorize("OWNER"),
  updateDesignation,
);

router.patch(
  "/status/:designationId",
  authenticateUser,
  authorize("OWNER"),
  updateDesignationStatus,
);

export default router;
