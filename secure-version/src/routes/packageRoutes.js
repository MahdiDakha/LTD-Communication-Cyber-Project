import express from "express";
import {
  showPackagesPage,
  requestPackage,
} from "../controllers/packageController.js";
import { requireAuth, requireViewer } from "../middleware/authMiddleware.js";

const router = express.Router();

// The catalog is public to logged-out users, but requesting a package requires
// an authenticated viewer account.
router.get("/packages", showPackagesPage);
router.post(
  "/packages/request/:packageId",
  requireAuth,
  requireViewer,
  requestPackage,
);

export default router;
