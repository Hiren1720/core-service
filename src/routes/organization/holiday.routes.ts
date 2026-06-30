import { Router } from "express";
import { authenticateUser } from "../../middleware/user.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { createHoliday, getHolidayById, getHolidays, updateHoliday, updateHolidayStatus } from "../../controllers/organization/holiday.controller.js";

const router = Router();

router.post(
    "/",
    authenticateUser,
    authorize("OWNER"),
    createHoliday
);

router.get(
    "/",
    authenticateUser,
    getHolidays
);

router.get(
    "/:holidayId",
    authenticateUser,
    getHolidayById
);

router.put(
    "/:holidayId",
    authenticateUser,
    authorize("OWNER"),
    updateHoliday
);

router.patch(
    "/status/:holidayId",
    authenticateUser,
    authorize("OWNER"),
    updateHolidayStatus
);

export default router;