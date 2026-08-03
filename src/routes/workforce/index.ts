import { Router } from "express";
import OnboardRoutes from "./onboard.routes";
import EmployeeRoutes from "./employee.routes";
import PromotionRoutes from "./promotion.routes";
import TerminationRoutes from "./termination.routes";
import ResignationRoutes from "./resignation.routes";
import { getCompanyDetailsforLetters } from "../../controllers/workforce/index.controller";
import { authenticateUser } from "../../middleware/user.middleware";

const router = Router();

router.use("/onboard", OnboardRoutes);

router.use("/employee", EmployeeRoutes);

router.use("/promotion", PromotionRoutes);

router.use("/termination", TerminationRoutes);

router.use("/resignation", ResignationRoutes);

router.get("/company-details", authenticateUser, getCompanyDetailsforLetters);

export default router;
