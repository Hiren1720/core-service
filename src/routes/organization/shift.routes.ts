import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { createShift, getShiftById, getShifts, updateShift, updateShiftStatus } from "../../controllers/organization/shift.controller.js";

const router = Router();

router.post(
    "/",
    authenticateUser,
    authorize("OWNER"),
    createShift
);

router.get(
    "/",
    authenticateUser,
    getShifts
);

router.get(
    "/:shiftId",
    authenticateUser,
    getShiftById
);

router.put(
    "/:shiftId",
    authenticateUser,
    authorize("OWNER"),
    updateShift
);

router.patch(
    "/status/:shiftId",
    authenticateUser,
    authorize("OWNER"),
    updateShiftStatus
);

export default router;