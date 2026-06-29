import express from "express";
import {
  showPackagesPage,
  requestPackage,
} from "../controllers/packageController.js";
import { requireAuth, requireViewer } from "../middleware/authMiddleware.js";

const router = express.Router();

// Package browsing is public to the app, but request submission still requires
// an authenticated viewer account.
router.get("/packages", showPackagesPage);
router.post(
  "/packages/request/:packageId",
  requireAuth,
  requireViewer,
  requestPackage,
);

export default router;
