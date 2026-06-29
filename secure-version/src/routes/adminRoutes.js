import express from "express";
import {
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
} from "../controllers/adminController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin request reviews are exposed as dedicated mutation endpoints so the
// dashboard can approve or reject without duplicating logic.
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
