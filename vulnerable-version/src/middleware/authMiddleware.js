// Shared redirect helper keeps authorization failures consistent across the
// route layer.
function redirectWithError(res, message) {
  return res.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

// Role guards stay in middleware so the route files can read as an access map,
// even in the intentionally vulnerable demo build.
export function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "admin") {
    return redirectWithError(
      res,
      "Access denied. Only admin users can access this page.",
    );
  }

  next();
}

export function requireViewer(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "viewer") {
    return redirectWithError(
      res,
      "Access denied. Only viewer users can perform this action.",
    );
  }

  next();
}

export function requireCustomer(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "customer") {
    return redirectWithError(
      res,
      "Access denied. Only customer users can perform this action.",
    );
  }

  next();
}
