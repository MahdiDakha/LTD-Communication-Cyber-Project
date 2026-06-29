import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import { fileURLToPath } from "url";

import db from "./database.js";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";


// Bootstrap for the vulnerable demo. The infrastructure matches the secure
// build so readers can focus on the intentionally unsafe controller code.
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "../.env"),
});
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "connect.sid",
    secret: process.env.SESSION_SECRET || "default_session_secret",
    resave: false,
    saveUninitialized: false,
  }),
);

// Session data is reloaded from the database on every request so changes to
// role/package state appear immediately in templates.
app.use((req, res, next) => {
  if (!req.session.user) {
    res.locals.user = null;
    next();
    return;
  }

  db.get(
    `SELECT id, username, email, role, package_id
     FROM users
     WHERE id = ?`,
    [req.session.user.id],
    (err, user) => {
      if (err) {
        console.log("Session sync error:", err.message);
        res.locals.user = req.session.user;
        next();
        return;
      }

      if (!user) {
        req.session.destroy(() => {
          res.locals.user = null;
          next();
        });
        return;
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || "viewer",
        package_id: user.package_id || null,
      };

      res.locals.user = req.session.user;
      next();
    },
  );
});

// All major route modules are mounted here; the difference between builds lives
// inside the controllers rather than the route map.
app.use("/", packageRoutes);
app.use("/", authRoutes);
app.use("/", adminRoutes);
app.use("/customers", customerRoutes);

app.get("/", (req, res) => {
  res.render("home", {
    title: "LTD Communication",
    user: req.session.user || null,
  });
});

const PORT = process.env.PORT || 3001;
const APP_LABEL = "Vulnerable version";

app.listen(PORT, () => {
  console.log(`${APP_LABEL} is running on port ${PORT}`);
  console.log(`localhost:${PORT}`);
  console.log("HMAC_SECRET loaded:", process.env.HMAC_SECRET ? "YES" : "NO");
  console.log("PORT loaded:", process.env.PORT);
});
