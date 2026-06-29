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

// Server bootstrap for the secure build: wire templates, sessions, shared
// database access and route modules in one place.
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

// Keep req.session.user and res.locals.user synchronized with the database so
// role/package changes made elsewhere are reflected on the next request.
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

// Most route modules mount at "/", so their internal path definitions decide
// the public URL structure.
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

const PORT = process.env.PORT || 3000;
const APP_LABEL = "Secure version";

app.listen(PORT, () => {
  console.log(`${APP_LABEL} is running on port ${PORT}`);
  console.log(process.env.PORT);
});
