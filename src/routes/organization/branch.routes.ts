import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { createBranch, getBranchById, getBranches, updateBranch, updateBranchStatus } from "../../controllers/organization/branch.controller.js";

const router = Router();

router.post(
    "/",
    authenticateUser,
    authorize("OWNER"),
    createBranch
);

router.get(
    "/",
    authenticateUser,
    getBranches
);

router.get(
    "/:branchId",
    authenticateUser,
    getBranchById
);

router.put(
    "/:branchId",
    authenticateUser,
    authorize("OWNER"),
    updateBranch
);

router.patch(
    "/status/:branchId",
    authenticateUser,
    authorize("OWNER"),
    updateBranchStatus
);

export default router;