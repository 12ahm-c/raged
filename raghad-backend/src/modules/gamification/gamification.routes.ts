import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './gamification.controller';

const router = Router();

router.use(authMiddleware);
router.get('/points', asyncHandler(controller.points));
router.get('/streaks', asyncHandler(controller.streaks));
router.get('/stats', asyncHandler(controller.stats));
router.get('/levels', asyncHandler(controller.levels));

export default router;
