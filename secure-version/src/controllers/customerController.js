import db from "../database.js";
import { validateCustomerInput } from "../utils/validationUtils.js";

// The customers page needs three related datasets every time it renders:
// existing customers, selectable sectors and available packages.
function loadCustomersData(callback) {
  db.all(
    `SELECT
       customers.id,
       customers.full_name,
       customers.email,
       customers.phone,
       sectors.sector_name,
       internet_packages.package_name,
       internet_packages.speed,
       internet_packages.price,
       customers.created_at
     FROM customers
     LEFT JOIN sectors ON customers.sector_id = sectors.id
     LEFT JOIN internet_packages ON customers.package_id = internet_packages.id
     ORDER BY customers.created_at DESC`,
    [],
    (customersErr, customers) => {
      if (customersErr) {
        callback(customersErr);
        return;
      }

      db.all(
        "SELECT * FROM sectors ORDER BY sector_name",
        [],
        (sectorsErr, sectors) => {
          if (sectorsErr) {
            callback(sectorsErr);
            return;
          }

          db.all(
            "SELECT * FROM internet_packages ORDER BY price",
            [],
            (packagesErr, packages) => {
              if (packagesErr) {
                callback(packagesErr);
                return;
              }

              callback(null, {
                customers,
                sectors,
                packages,
              });
            },
          );
        },
      );
    },
  );
}

// Centralize template rendering so success/error handling does not duplicate
// the same view payload shape.
function renderCustomersPage(req, res, data, messages, statusCode = 200) {
  return res.status(statusCode).render("customers", {
    title: "Customers",
    user: req.session.user || null,
    error: messages.error,
    success: messages.success,
    customers: data.customers,
    sectors: data.sectors,
    packages: data.packages,
  });
}

// After any mutation we reload the lookup data so the page reflects the latest
// DB state and the form still has its dropdown options.
function reloadCustomersPage(req, res, messages, statusCode = 200) {
  loadCustomersData((loadErr, data) => {
    if (loadErr) {
      console.log("Customers reload error:", loadErr.message);

      return res.status(500).render("customers", {
        title: "Customers",
        user: req.session.user || null,
        error: "Failed to load customers data",
        success: null,
        customers: [],
        sectors: [],
        packages: [],
      });
    }

    return renderCustomersPage(req, res, data, messages, statusCode);
  });
}

export function showCustomersPage(req, res) {
  loadCustomersData((loadErr, data) => {
    if (loadErr) {
      console.log("Customers load error:", loadErr.message);

      return res.status(500).render("customers", {
        title: "Customers",
        user: req.session.user || null,
        error: "Failed to load customers data",
        success: null,
        customers: [],
        sectors: [],
        packages: [],
      });
    }

    return renderCustomersPage(
      req,
      res,
      data,
      {
        error: null,
        success: null,
      },
    );
  });
}

export function createCustomer(req, res) {
  const { fullName, email, phone, sectorId, packageId } = req.body;

  if (!fullName) {
    return reloadCustomersPage(
      req,
      res,
      {
        error: "Customer full name is required",
        success: null,
      },
      400,
    );
  }

  const customerValidation = validateCustomerInput({
    fullName,
    email,
    phone,
  });

  // The secure build validates user-controlled text before sending it to the
  // database and uses parameterized SQL for the insert itself.
  if (!customerValidation.isValid) {
    return reloadCustomersPage(
      req,
      res,
      {
        error: customerValidation.errors.join(", "),
        success: null,
      },
      400,
    );
  }

  db.run(
    `INSERT INTO customers (full_name, email, phone, sector_id, package_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      fullName,
      email || null,
      phone || null,
      sectorId || null,
      packageId || null,
    ],
    function (insertErr) {
      if (insertErr) {
        console.log("Customer insert error:", insertErr.message);

        return reloadCustomersPage(
          req,
          res,
          {
            error: "Failed to create customer",
            success: null,
          },
          500,
        );
      }

      return reloadCustomersPage(req, res, {
        error: null,
        success: `Customer ${fullName} was created successfully`,
      });
    },
  );
}
