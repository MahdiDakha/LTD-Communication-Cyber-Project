import express from "express";
import {
  showRegisterPage,
  register,
  showLoginPage,
  login,
  dashboard,
  logout,
  showChangePasswordPage,
  changePassword,
  disconnectService,
  showForgotPasswordPage,
  forgotPassword,
  showResetPasswordPage,
  resetPassword
} from "../controllers/authController.js";
import { requireAuth, requireCustomer } from "../middleware/authMiddleware.js";

const router = express.Router();

// Auth routes remain intentionally thin: they declare URL shape and access
// checks, while the controller owns the actual workflow.
router.get("/register", showRegisterPage);
router.post("/register", register);

router.get("/login", showLoginPage);
router.post("/login", login);

router.get("/dashboard", requireAuth, dashboard);
router.get("/logout", requireAuth, logout);

router.get("/change-password", requireAuth, showChangePasswordPage);
router.post("/change-password", requireAuth, changePassword);
router.post("/disconnect-service", requireAuth, requireCustomer, disconnectService);

router.get("/forgot-password", showForgotPasswordPage);
router.post("/forgot-password", forgotPassword);

router.get("/reset-password", showResetPasswordPage);
router.post("/reset-password", resetPassword);

export default router;
