import express from "express";
import {
  showCustomersPage,
  createCustomer
} from "../controllers/customerController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer management remains an admin-only area in both app variants.
router.get("/", requireAuth, requireAdmin, showCustomersPage);
router.post("/", requireAuth, requireAdmin, createCustomer);

export default router;
