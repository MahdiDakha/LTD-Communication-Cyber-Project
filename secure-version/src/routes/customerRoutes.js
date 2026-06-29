import express from "express";
import {
  showCustomersPage,
  createCustomer
} from "../controllers/customerController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer management is an admin-only workflow, so both routes share the same
// auth and role checks.
router.get("/", requireAuth, requireAdmin, showCustomersPage);
router.post("/", requireAuth, requireAdmin, createCustomer);

export default router;
