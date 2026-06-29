import db from "../database.js";

// Promise wrappers make the multi-step review transaction easier to follow.
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

async function findRequestById(requestId) {
  return getQuery(
    `SELECT
       subscription_requests.id,
       subscription_requests.user_id,
       subscription_requests.package_id,
       subscription_requests.status,
       users.username,
       users.email,
       internet_packages.package_name,
       internet_packages.speed,
       internet_packages.price
     FROM subscription_requests
     INNER JOIN users ON users.id = subscription_requests.user_id
     INNER JOIN internet_packages ON internet_packages.id = subscription_requests.package_id
     WHERE subscription_requests.id = ?`,
    [requestId],
  );
}

async function upsertCustomerRecord(requestRow) {
  const existingCustomer = await getQuery(
    "SELECT id FROM customers WHERE email = ? LIMIT 1",
    [requestRow.email],
  );

  // Approving a subscription request either updates the matching customer row
  // or creates one if the user is being converted for the first time.
  if (existingCustomer) {
    await runQuery(
      `UPDATE customers
         SET full_name = ?, email = ?, package_id = ?
         WHERE id = ?`,
      [
        requestRow.username,
        requestRow.email,
        requestRow.package_id,
        existingCustomer.id,
      ],
    );

    return;
  }

  await runQuery(
    `INSERT INTO customers (full_name, email, package_id)
     VALUES (?, ?, ?)`,
    [requestRow.username, requestRow.email, requestRow.package_id],
  );
}

async function reviewRequest(req, res, nextStatus) {
  const requestId = req.params.requestId;
  const adminUserId = req.session.user.id;

  try {
    const requestRow = await findRequestById(requestId);

    if (!requestRow) {
      return res.redirect(
        "/dashboard?error=" +
          encodeURIComponent("Subscription request was not found."),
      );
    }

    if (requestRow.status !== "pending") {
      return res.redirect(
        "/dashboard?error=" +
          encodeURIComponent("Only pending subscription requests can be reviewed."),
      );
    }

    // Reviewing a request affects multiple tables, so the transaction prevents
    // partial approval/rejection state if one step fails.
    await runQuery("BEGIN TRANSACTION");

    const reviewUpdate = await runQuery(
      `UPDATE subscription_requests
         SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
         WHERE id = ? AND status = 'pending'`,
      [nextStatus, adminUserId, requestId],
    );

    if (reviewUpdate.changes === 0) {
      throw new Error("Subscription request review lost pending status");
    }

    if (nextStatus === "approved") {
      await runQuery(
        `UPDATE users
           SET role = 'customer', package_id = ?
           WHERE id = ?`,
        [requestRow.package_id, requestRow.user_id],
      );

      await upsertCustomerRecord(requestRow);
    }

    await runQuery("COMMIT");

    const successMessage =
      nextStatus === "approved"
        ? `Subscription request #${requestId} approved successfully.`
        : `Subscription request #${requestId} rejected successfully.`;

    return res.redirect(
      "/dashboard?success=" + encodeURIComponent(successMessage),
    );
  } catch (err) {
    try {
      await runQuery("ROLLBACK");
    } catch (rollbackErr) {
      console.log("Admin request rollback error:", rollbackErr.message);
    }

    console.log("Admin request review error:", err.message);

    return res.redirect(
      "/dashboard?error=" +
        encodeURIComponent("Failed to review the subscription request."),
    );
  }
}

export function approveSubscriptionRequest(req, res) {
  return reviewRequest(req, res, "approved");
}

export function rejectSubscriptionRequest(req, res) {
  return reviewRequest(req, res, "rejected");
}
