import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tripsRouter from "./trips";
import adminRouter from "./admin";
import groupsRouter from "./groups";
import profileRouter from "./profile";
import ietRouter from "./iet";
import businessRouter from "./business";
import pingRouter from "./ping";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tripsRouter);
router.use(adminRouter);
router.use(groupsRouter);
router.use(profileRouter);
router.use(ietRouter);
router.use(businessRouter);
router.use(pingRouter);

export default router;
