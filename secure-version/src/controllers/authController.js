import db from "../database.js";
import passwordConfig from "../config/passwordConfig.js";
import {
  generateSalt,
  createPasswordHash,
  verifyPassword,
  generateSha1Token,
} from "../utils/passwordUtils.js";
import {
  validatePasswordStrength,
  isValidEmail,
} from "../utils/validationUtils.js";

// Keep page rendering consistent so every auth-related view receives the
// current session user plus route-specific data.
function renderView(req, res, view, locals) {
  return res.render(view, {
    user: req.session.user || null,
    ...locals,
  });
}

// Small Promise wrappers let the larger workflows read like linear business
// logic instead of nested sqlite callbacks.
function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row || null);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

export function showRegisterPage(req, res) {
  return renderView(req, res, "register", {
    title: "Register",
    error: null,
    success: null,
    formData: {},
  });
}

export function register(req, res) {
  const { username, email, password } = req.body;

  const formData = {
    username,
    email,
  };

  if (!username || !email || !password) {
    return res.status(400).render("register", {
      title: "Register",
      user: req.session.user || null,
      error: "All fields are required",
      success: null,
      formData,
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).render("register", {
      title: "Register",
      user: req.session.user || null,
      error: "Invalid email format",
      success: null,
      formData,
    });
  }

  const passwordValidation = validatePasswordStrength(password);

  if (!passwordValidation.isValid) {
    return res.status(400).render("register", {
      title: "Register",
      user: req.session.user || null,
      error: passwordValidation.errors.join(", "),
      success: null,
      formData,
    });
  }

  db.get(
    "SELECT id FROM users WHERE username = ? OR email = ?",
    [username, email],
    (err, existingUser) => {
      if (err) {
        console.log("Register select error:", err.message);

        return res.status(500).render("register", {
          title: "Register",
          user: req.session.user || null,
          error: "Database error",
          success: null,
          formData,
        });
      }

      if (existingUser) {
        return res.status(409).render("register", {
          title: "Register",
          user: req.session.user || null,
          error: "Username or email already exists",
          success: null,
          formData,
        });
      }

      // Registration stores the user and immediately records the same password
      // in history so future password changes can block reuse.
      const salt = generateSalt();
      const passwordHash = createPasswordHash(password, salt);

      db.run(
        `INSERT INTO users (username, email, password_hash, salt, role)
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, passwordHash, salt, "viewer"],
        function (insertErr) {
          if (insertErr) {
            console.log("Register insert error:", insertErr.message);

            return res.status(500).render("register", {
              title: "Register",
              user: req.session.user || null,
              error: "Failed to create user",
              success: null,
              formData,
            });
          }

          const userId = this.lastID;

          db.run(
            `INSERT INTO password_history (user_id, password_hash, salt)
             VALUES (?, ?, ?)`,
            [userId, passwordHash, salt],
            (historyErr) => {
              if (historyErr) {
                console.log(
                  "Password history insert error:",
                  historyErr.message,
                );

                return res.status(500).render("register", {
                  title: "Register",
                  user: req.session.user || null,
                  error: "User created, but failed to save password history",
                  success: null,
                  formData,
                });
              }

              return res.render("register", {
                title: "Register",
                user: req.session.user || null,
                error: null,
                success:
                  "User registered successfully. The default role is viewer. You can now login.",
                formData: {},
              });
            },
          );
        },
      );
    },
  );
}

export function showLoginPage(req, res) {
  return renderView(req, res, "login", {
    title: "Login",
    error: null,
    success: null,
    formData: {},
  });
}

export function login(req, res) {
  const { username, password } = req.body;

  const formData = {
    username,
  };

  if (!username || !password) {
    return res.status(400).render("login", {
      title: "Login",
      user: req.session.user || null,
      error: "Username and password are required",
      success: null,
      formData,
    });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.log("Login select error:", err.message);

      return res.status(500).render("login", {
        title: "Login",
        user: req.session.user || null,
        error: "Database error",
        success: null,
        formData,
      });
    }

    if (!user) {
      return res.status(401).render("login", {
        title: "Login",
        user: req.session.user || null,
        error: "Invalid username or password",
        success: null,
        formData,
      });
    }

    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      const now = new Date();

      if (lockedUntil > now) {
        return res.status(423).render("login", {
          title: "Login",
          user: req.session.user || null,
          error: `Account is locked until ${lockedUntil.toLocaleString()}`,
          success: null,
          formData,
        });
      }
    }

    const isPasswordValid = verifyPassword(
      password,
      user.salt,
      user.password_hash,
    );

    if (!isPasswordValid) {
      const newFailedAttempts = user.failed_attempts + 1;

      // Failed login attempts are tracked in the database so lockouts survive
      // server restarts and apply consistently across sessions.
      if (newFailedAttempts >= passwordConfig.maxLoginAttempts) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + 5);

        db.run(
          `UPDATE users
             SET failed_attempts = ?, locked_until = ?
             WHERE id = ?`,
          [newFailedAttempts, lockedUntil.toISOString(), user.id],
          (updateErr) => {
            if (updateErr) {
              console.log("Login lock update error:", updateErr.message);
            }

            return res.status(423).render("login", {
              title: "Login",
              user: req.session.user || null,
              error:
                "Account locked due to too many failed login attempts. Try again later.",
              success: null,
              formData,
            });
          },
        );

        return;
      }

      db.run(
        `UPDATE users
           SET failed_attempts = ?
           WHERE id = ?`,
        [newFailedAttempts, user.id],
        (updateErr) => {
          if (updateErr) {
            console.log("Failed attempts update error:", updateErr.message);
          }

          return res.status(401).render("login", {
            title: "Login",
            user: req.session.user || null,
            error: `Invalid username or password. Failed attempts: ${newFailedAttempts}/${passwordConfig.maxLoginAttempts}`,
            success: null,
            formData,
          });
        },
      );

      return;
    }

    db.run(
      `UPDATE users
         SET failed_attempts = 0, locked_until = NULL
         WHERE id = ?`,
      [user.id],
      (updateErr) => {
        if (updateErr) {
          console.log("Login reset attempts error:", updateErr.message);

          return res.status(500).render("login", {
            title: "Login",
            user: req.session.user || null,
            error: "Database error",
            success: null,
            formData,
          });
        }

        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || "viewer",
          package_id: user.package_id || null,
        };

        return res.redirect("/dashboard");
      },
    );
  });
}

export async function dashboard(req, res) {
  const currentUser = req.session.user;
  const error = req.query.error || null;
  const success = req.query.success || null;

  try {
    let currentPackage = null;
    let latestRequest = null;
    let pendingRequests = [];

    // The dashboard is role-aware: admins review pending requests, customers
    // see their active package, and viewers see their latest subscription state.
    if (currentUser.role === "admin") {
      pendingRequests = await allQuery(
        `SELECT
           subscription_requests.id,
           subscription_requests.created_at,
           users.username,
           users.email,
           internet_packages.package_name,
           internet_packages.speed,
           internet_packages.price
         FROM subscription_requests
         INNER JOIN users ON users.id = subscription_requests.user_id
         INNER JOIN internet_packages ON internet_packages.id = subscription_requests.package_id
         WHERE subscription_requests.status = 'pending'
         ORDER BY subscription_requests.created_at ASC`,
        [],
      );
    } else if (currentUser.role === "customer") {
      currentPackage = await getQuery(
        `SELECT id, package_name, speed, price
         FROM internet_packages
         WHERE id = ?`,
        [currentUser.package_id],
      );
    } else {
      latestRequest = await getQuery(
        `SELECT
           subscription_requests.id,
           subscription_requests.status,
           subscription_requests.created_at,
           subscription_requests.reviewed_at,
           internet_packages.package_name,
           internet_packages.speed,
           internet_packages.price
         FROM subscription_requests
         INNER JOIN internet_packages ON internet_packages.id = subscription_requests.package_id
         WHERE subscription_requests.user_id = ?
         ORDER BY subscription_requests.created_at DESC
         LIMIT 1`,
        [currentUser.id],
      );
    }

    return renderView(req, res, "dashboard", {
      title: "Dashboard",
      error,
      success,
      currentPackage,
      latestRequest,
      pendingRequests,
    });
  } catch (err) {
    console.log("Dashboard load error:", err.message);

    return renderView(req, res, "dashboard", {
      title: "Dashboard",
      error: "Failed to load dashboard data",
      success: null,
      currentPackage: null,
      latestRequest: null,
      pendingRequests: [],
    });
  }
}

export function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

export function showChangePasswordPage(req, res) {
  return renderView(req, res, "change-password", {
    title: "Change Password",
    error: null,
    success: null,
  });
}

export function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).render("change-password", {
      title: "Change Password",
      user: req.session.user || null,
      error: "Current password and new password are required",
      success: null,
    });
  }

  const passwordValidation = validatePasswordStrength(newPassword);

  if (!passwordValidation.isValid) {
    return res.status(400).render("change-password", {
      title: "Change Password",
      user: req.session.user || null,
      error: passwordValidation.errors.join(", "),
      success: null,
    });
  }

  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      console.log("Change password select error:", err.message);

      return res.status(500).render("change-password", {
        title: "Change Password",
        user: req.session.user || null,
        error: "Database error",
        success: null,
      });
    }

    if (!user) {
      req.session.destroy(() => {
        return res.redirect("/login");
      });
      return;
    }

    const isCurrentPasswordValid = verifyPassword(
      currentPassword,
      user.salt,
      user.password_hash,
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).render("change-password", {
        title: "Change Password",
        user: req.session.user || null,
        error: "Current password is incorrect",
        success: null,
      });
    }

    db.all(
      `SELECT password_hash, salt
         FROM password_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      [userId, passwordConfig.passwordHistoryLimit],
      (historyErr, oldPasswords) => {
        if (historyErr) {
          console.log("Password history select error:", historyErr.message);

          return res.status(500).render("change-password", {
            title: "Change Password",
            user: req.session.user || null,
            error: "Database error",
            success: null,
          });
        }

        // Password history is checked before writing the new password so users
        // cannot cycle back through recently used credentials.
        for (const oldPassword of oldPasswords) {
          const reusedPassword = verifyPassword(
            newPassword,
            oldPassword.salt,
            oldPassword.password_hash,
          );

          if (reusedPassword) {
            return res.status(400).render("change-password", {
              title: "Change Password",
              user: req.session.user || null,
              error: `You cannot reuse your last ${passwordConfig.passwordHistoryLimit} passwords`,
              success: null,
            });
          }
        }

        const newSalt = generateSalt();
        const newPasswordHash = createPasswordHash(newPassword, newSalt);

        db.run(
          `UPDATE users
             SET password_hash = ?, salt = ?
             WHERE id = ?`,
          [newPasswordHash, newSalt, userId],
          (updateErr) => {
            if (updateErr) {
              console.log("Password update error:", updateErr.message);

              return res.status(500).render("change-password", {
                title: "Change Password",
                user: req.session.user || null,
                error: "Failed to update password",
                success: null,
              });
            }

            db.run(
              `INSERT INTO password_history (user_id, password_hash, salt)
                 VALUES (?, ?, ?)`,
              [userId, newPasswordHash, newSalt],
              (insertHistoryErr) => {
                if (insertHistoryErr) {
                  console.log(
                    "Password history insert error:",
                    insertHistoryErr.message,
                  );

                  return res.status(500).render("change-password", {
                    title: "Change Password",
                    user: req.session.user || null,
                    error:
                      "Password changed, but failed to update password history",
                    success: null,
                  });
                }

                return res.render("change-password", {
                  title: "Change Password",
                  user: req.session.user || null,
                  error: null,
                  success: "Password changed successfully",
                });
              },
            );
          },
        );
      },
    );
  });
}

export async function disconnectService(req, res) {
  const userId = req.session.user.id;

  try {
    await runQuery(
      `UPDATE users
         SET role = 'viewer', package_id = NULL
         WHERE id = ?`,
      [userId],
    );

    req.session.user = {
      ...req.session.user,
      role: "viewer",
      package_id: null,
    };

    return res.redirect(
      "/dashboard?success=" +
        encodeURIComponent("Service disconnected successfully."),
    );
  } catch (err) {
    console.log("Disconnect service error:", err.message);

    return res.redirect(
      "/dashboard?error=" +
        encodeURIComponent("Failed to disconnect the current service."),
    );
  }
}

export function showForgotPasswordPage(req, res) {
  return renderView(req, res, "forgot-password", {
    title: "Forgot Password",
    error: null,
    success: null,
    demoToken: null,
    email: "",
  });
}

export function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).render("forgot-password", {
      title: "Forgot Password",
      user: req.session.user || null,
      error: "Email is required",
      success: null,
      demoToken: null,
      email: "",
    });
  }

  db.get(
    "SELECT id, username, email FROM users WHERE email = ?",
    [email],
    (err, user) => {
      if (err) {
        console.log("Forgot password select error:", err.message);

        return res.status(500).render("forgot-password", {
          title: "Forgot Password",
          user: req.session.user || null,
          error: "Database error",
          success: null,
          demoToken: null,
          email,
        });
      }

      if (!user) {
        return res.status(404).render("forgot-password", {
          title: "Forgot Password",
          user: req.session.user || null,
          error: "User with this email was not found",
          success: null,
          demoToken: null,
          email,
        });
      }

      const token = generateSha1Token();

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // This demo app surfaces the token in the UI/console instead of sending
      // email so the reset flow can be exercised locally.
      db.run(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [user.id, token, expiresAt.toISOString()],
        (insertErr) => {
          if (insertErr) {
            console.log("Reset token insert error:", insertErr.message);

            return res.status(500).render("forgot-password", {
              title: "Forgot Password",
              user: req.session.user || null,
              error: "Failed to generate reset token",
              success: null,
              demoToken: null,
              email,
            });
          }

          console.log("======================================");
          console.log(`Password reset token for ${user.email}:`);
          console.log(token);
          console.log("======================================");

          return res.render("forgot-password", {
            title: "Forgot Password",
            user: req.session.user || null,
            error: null,
            success:
              "Reset token generated successfully. In a real system, it would be sent by email.",
            demoToken: token,
            email,
          });
        },
      );
    },
  );
}

export function showResetPasswordPage(req, res) {
  return renderView(req, res, "reset-password", {
    title: "Reset Password",
    error: null,
    success: null,
    formData: {
      email: req.query.email || "",
      token: req.query.token || "",
    },
  });
}

export function resetPassword(req, res) {
  const { email, token, newPassword } = req.body;

  const formData = {
    email,
    token,
  };

  if (!email || !token || !newPassword) {
    return res.status(400).render("reset-password", {
      title: "Reset Password",
      user: req.session.user || null,
      error: "Email, token and new password are required",
      success: null,
      formData,
    });
  }

  const passwordValidation = validatePasswordStrength(newPassword);

  if (!passwordValidation.isValid) {
    return res.status(400).render("reset-password", {
      title: "Reset Password",
      user: req.session.user || null,
      error: passwordValidation.errors.join(", "),
      success: null,
      formData,
    });
  }

  db.get(
    "SELECT id, username, email FROM users WHERE email = ?",
    [email],
    (userErr, user) => {
      if (userErr) {
        console.log("Reset password user select error:", userErr.message);

        return res.status(500).render("reset-password", {
          title: "Reset Password",
          user: req.session.user || null,
          error: "Database error",
          success: null,
          formData,
        });
      }

      if (!user) {
        return res.status(404).render("reset-password", {
          title: "Reset Password",
          user: req.session.user || null,
          error: "User not found",
          success: null,
          formData,
        });
      }

      db.get(
        `SELECT *
         FROM password_reset_tokens
         WHERE user_id = ?
         AND token_hash = ?
         AND used = 0
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id, token],
        (tokenErr, resetToken) => {
          if (tokenErr) {
            console.log("Reset token select error:", tokenErr.message);

            return res.status(500).render("reset-password", {
              title: "Reset Password",
              user: req.session.user || null,
              error: "Database error",
              success: null,
              formData,
            });
          }

          if (!resetToken) {
            return res.status(400).render("reset-password", {
              title: "Reset Password",
              user: req.session.user || null,
              error: "Invalid reset token",
              success: null,
              formData,
            });
          }

          const now = new Date();
          const expiresAt = new Date(resetToken.expires_at);

          if (expiresAt < now) {
            return res.status(400).render("reset-password", {
              title: "Reset Password",
              user: req.session.user || null,
              error: "Reset token expired",
              success: null,
              formData,
            });
          }

          db.all(
            `SELECT password_hash, salt
             FROM password_history
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [user.id, passwordConfig.passwordHistoryLimit],
            (historyErr, oldPasswords) => {
              if (historyErr) {
                console.log(
                  "Reset password history select error:",
                  historyErr.message,
                );

                return res.status(500).render("reset-password", {
                  title: "Reset Password",
                  user: req.session.user || null,
                  error: "Database error",
                  success: null,
                  formData,
                });
              }

              // Reseting a password follows the same reuse policy as the
              // regular change-password flow.
              for (const oldPassword of oldPasswords) {
                const reusedPassword = verifyPassword(
                  newPassword,
                  oldPassword.salt,
                  oldPassword.password_hash,
                );

                if (reusedPassword) {
                  return res.status(400).render("reset-password", {
                    title: "Reset Password",
                    user: req.session.user || null,
                    error: `You cannot reuse your last ${passwordConfig.passwordHistoryLimit} passwords`,
                    success: null,
                    formData,
                  });
                }
              }

              const newSalt = generateSalt();
              const newPasswordHash = createPasswordHash(newPassword, newSalt);

              db.run(
                `UPDATE users
                 SET password_hash = ?, salt = ?, failed_attempts = 0, locked_until = NULL
                 WHERE id = ?`,
                [newPasswordHash, newSalt, user.id],
                (updateErr) => {
                  if (updateErr) {
                    console.log(
                      "Reset password update error:",
                      updateErr.message,
                    );

                    return res.status(500).render("reset-password", {
                      title: "Reset Password",
                      user: req.session.user || null,
                      error: "Failed to reset password",
                      success: null,
                      formData,
                    });
                  }

                  db.run(
                    `INSERT INTO password_history (user_id, password_hash, salt)
                     VALUES (?, ?, ?)`,
                    [user.id, newPasswordHash, newSalt],
                    (historyInsertErr) => {
                      if (historyInsertErr) {
                        console.log(
                          "Reset password history insert error:",
                          historyInsertErr.message,
                        );

                        return res.status(500).render("reset-password", {
                          title: "Reset Password",
                          user: req.session.user || null,
                          error:
                            "Password changed, but failed to update password history",
                          success: null,
                          formData,
                        });
                      }

                      db.run(
                        `UPDATE password_reset_tokens
                         SET used = 1
                         WHERE id = ?`,
                        [resetToken.id],
                        (markUsedErr) => {
                          if (markUsedErr) {
                            console.log(
                              "Mark reset token used error:",
                              markUsedErr.message,
                            );
                          }

                          return res.render("reset-password", {
                            title: "Reset Password",
                            user: req.session.user || null,
                            error: null,
                            success:
                              "Password reset successfully. You can now login.",
                            formData: {
                              email: "",
                              token: "",
                            },
                          });
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      );
    },
  );
}
