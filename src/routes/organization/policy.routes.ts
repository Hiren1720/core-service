import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import {
  createPolicy,
  getPolicies,
  getPolicyById,
  getPolicyCount,
  updatePolicy,
  updatePolicyStatus,
} from "../../controllers/organization/policy.controller.js";

const router = Router();

router.post("/", authenticateUser, authorize("OWNER"), createPolicy);

router.get("/", authenticateUser, getPolicies);

router.get("/count", authenticateUser, getPolicyCount);

router.get("/:policyId", authenticateUser, getPolicyById);

router.put("/:policyId", authenticateUser, authorize("OWNER"), updatePolicy);

router.patch(
  "/status/:policyId",
  authenticateUser,
  authorize("OWNER"),
  updatePolicyStatus,
);

export default router;
