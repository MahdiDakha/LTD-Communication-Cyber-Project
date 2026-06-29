import express from "express";
import {
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
} from "../controllers/adminController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin review endpoints are isolated so the dashboard can post explicit
// approve/reject actions.
router.post(
  "/admin/requests/:requestId/approve",
  requireAuth,
  requireAdmin,
  approveSubscriptionRequest,
);

router.post(
  "/admin/requests/:requestId/reject",
  requireAuth,
  requireAdmin,
  rejectSubscriptionRequest,
);

export default router;
