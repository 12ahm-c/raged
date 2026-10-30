import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as authController from '../auth/auth.controller';
import { updateProfileSchema, updateSettingsSchema } from '../auth/dtos/auth.dto';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.put('/me', authMiddleware, validate(updateProfileSchema), asyncHandler(authController.updateProfile));
router.get('/me/settings', authMiddleware, asyncHandler(authController.getSettings));
router.put('/me/settings', authMiddleware, validate(updateSettingsSchema), asyncHandler(authController.updateSettings));

export default router;
