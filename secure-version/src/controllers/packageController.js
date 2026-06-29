import db from "../database.js";

// Promise-based sqlite helpers keep the read flows compact and consistent with
// the other controllers.
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

async function getAllPackages() {
  return allQuery(
    `SELECT id, package_name, speed, price
     FROM internet_packages
     ORDER BY price ASC, package_name ASC`,
    [],
  );
}

async function getLatestRequestForUser(userId) {
  return getQuery(
    `SELECT
       subscription_requests.id,
       subscription_requests.package_id,
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
    [userId],
  );
}

async function getPendingRequestForUser(userId) {
  return getQuery(
    `SELECT
       subscription_requests.id,
       subscription_requests.package_id,
       subscription_requests.status,
       subscription_requests.created_at,
       internet_packages.package_name,
       internet_packages.speed,
       internet_packages.price
     FROM subscription_requests
     INNER JOIN internet_packages ON internet_packages.id = subscription_requests.package_id
     WHERE subscription_requests.user_id = ?
       AND subscription_requests.status = 'pending'
     ORDER BY subscription_requests.created_at DESC
     LIMIT 1`,
    [userId],
  );
}

async function getCurrentPackage(packageId) {
  if (!packageId) {
    return null;
  }

  return getQuery(
    `SELECT id, package_name, speed, price
     FROM internet_packages
     WHERE id = ?`,
    [packageId],
  );
}

export async function showPackagesPage(req, res) {
  try {
    const packages = await getAllPackages();
    let currentPackage = null;
    let latestRequest = null;
    let pendingRequest = null;

    // One page serves three different states: anonymous browsing, active
    // customers checking their package, and viewers tracking request status.
    if (req.session.user) {
      if (req.session.user.role === "customer") {
        currentPackage = await getCurrentPackage(req.session.user.package_id);
      } else if (req.session.user.role === "viewer") {
        latestRequest = await getLatestRequestForUser(req.session.user.id);
        pendingRequest = await getPendingRequestForUser(req.session.user.id);
      }
    }

    return res.render("packages", {
      title: "Packages",
      user: req.session.user || null,
      error: req.query.error || null,
      success: req.query.success || null,
      packages,
      currentPackage,
      latestRequest,
      pendingRequest,
    });
  } catch (err) {
    console.log("Packages page select error:", err.message);

    return res.status(500).render("packages", {
      title: "Packages",
      user: req.session.user || null,
      error: "Failed to load internet packages",
      success: null,
      packages: [],
      currentPackage: null,
      latestRequest: null,
      pendingRequest: null,
    });
  }
}

export async function requestPackage(req, res) {
  const packageId = req.params.packageId;
  const userId = req.session.user.id;

  try {
    const internetPackage = await getQuery(
      `SELECT id, package_name
       FROM internet_packages
       WHERE id = ?`,
      [packageId],
    );

    if (!internetPackage) {
      return res.redirect(
        "/packages?error=" +
          encodeURIComponent("The selected internet package was not found."),
      );
    }

    const pendingRequest = await getPendingRequestForUser(userId);

    // A viewer can only have one outstanding request at a time; the admin
    // dashboard is the place where that request gets resolved.
    if (pendingRequest) {
      return res.redirect(
        "/packages?error=" +
          encodeURIComponent(
            "You already have a pending package request. Please wait for admin review.",
          ),
      );
    }

    await runQuery(
      `INSERT INTO subscription_requests (user_id, package_id, status)
       VALUES (?, ?, 'pending')`,
      [userId, packageId],
    );

    return res.redirect(
      "/packages?success=" +
        encodeURIComponent(
          `Package request submitted for ${internetPackage.package_name}.`,
        ),
    );
  } catch (err) {
    console.log("Package request error:", err.message);

    return res.redirect(
      "/packages?error=" +
        encodeURIComponent("Failed to submit the package request."),
    );
  }
}
