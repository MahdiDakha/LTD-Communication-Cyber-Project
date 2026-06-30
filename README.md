# LTD Communication Cyber Project

## Overview

LTD Communication is a web-based information system developed as a final cyber project.

The system represents a fictional internet communication company that manages users, internet packages, customer subscription requests, and customer records.

The project includes two separate versions:

1. `secure-version`
   A protected implementation that follows secure development principles.

2. `vulnerable-version`
   A deliberately vulnerable implementation used only for academic demonstration of SQL Injection and Stored XSS.

The goal of the project is to demonstrate vulnerable coding patterns, show how attacks work, and compare them with secure implementations.

---

## Technologies

| Component           | Technology         |
| ------------------- | ------------------ |
| Backend             | Node.js + Express  |
| Views               | EJS                |
| Database            | SQLite             |
| Authentication      | Express Session    |
| Password Protection | Salt + HMAC-SHA256 |
| Styling             | Plain CSS          |

---

## Project Structure

```text
COMMUNICATION_LTD/
│
├── secure-version/
│   ├── database/
│   │   └── communication_ltd_secure.db
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── public/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── views/
│   │   ├── database.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
│
├── vulnerable-version/
│   ├── database/
│   │   └── communication_ltd_vulnerable.db
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── public/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── views/
│   │   ├── database.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
│
├── database-scripts/
│   ├── schema.sql
│   ├── seed.sql
│   └── reset.sql
│
├── README.md
├── .gitignore
└── config.json
```

---

## Main Features

The system includes the following screens and flows:

### Authentication

* Register new users
* Login
* Logout
* Change password
* Forgot password
* Reset password using a SHA1-based token

### Password Security

The secure version includes:

* Password complexity policy
* Password rules managed through a configuration file
* Random salt generation
* HMAC-SHA256 password hashing
* Password history protection
* Login failed attempts
* Temporary account lockout after repeated failed login attempts

### Business Flow

The system includes a communication-company workflow:

* New users are created as `viewer`
* Viewers can browse internet packages
* Viewers can request to join an internet package
* Admin can approve or reject subscription requests
* Approved users become `customer`
* Customers can view their active internet package
* Customers can disconnect from the service and return to `viewer`

### Roles

| Role     | Description                                                             |
| -------- | ----------------------------------------------------------------------- |
| viewer   | Registered user who can browse packages and request a subscription      |
| customer | Approved user with an active internet package                           |
| admin    | System administrator who can approve requests and manage customers      |
| employee | Supported by the database schema, but not central to the main demo flow |

---

## Secure Version

The secure version demonstrates the protected implementation.

### SQL Injection Protection

The secure version uses parameterized queries with `?`.

Example:

```js
db.get(
  "SELECT * FROM users WHERE username = ?",
  [username],
  callback
);
```

This prevents user input from becoming part of the SQL command.

Instead of building SQL like this:

```js
const sql = `SELECT * FROM users WHERE username = '${username}'`;
```

the query and user data are sent separately to SQLite.

This protection is implemented in:

* Register
* Login
* Add Customer

---

### Stored XSS Protection

The secure version uses safe EJS output encoding:

```ejs
<%= customer.full_name %>
```

This encodes special characters before rendering user-controlled data.

| Character | Encoded Output |
| --------- | -------------- |
| `<`       | `&lt;`         |
| `>`       | `&gt;`         |
| `"`       | `&quot;`       |
| `'`       | `&#39;`        |
| `&`       | `&amp;`        |

As a result, malicious input is displayed as text instead of being executed as JavaScript.

Example malicious input:

```html
<script>alert("XSS")</script>
```

In the secure version, this payload is not executed by the browser.

---

## Vulnerable Version

The vulnerable version intentionally includes unsafe code for demonstration purposes only.

It is used to demonstrate:

* SQL Injection in Register
* SQL Injection in Login
* SQL Injection in Add Customer
* Stored XSS in the Customers table

This version must not be deployed or used in a real environment.

---

### SQL Injection in Register

The vulnerable Register flow uses string interpolation inside SQL queries.

Example:

```js
const checkUserSql = `SELECT id FROM users WHERE username ='${username}' OR email ='${email}'`;
```

Payload example:

```text
' OR '1'='1' --
```

This changes the SQL query behavior because the user input becomes part of the SQL command.

---

### SQL Injection in Login

The vulnerable Login flow allows SQL Injection to bypass the password condition.

Example payload:

```text
admin' --
```

This comments out the password check inside the SQL query.

Example resulting query:

```sql
SELECT * FROM users WHERE username = 'admin' --' AND password_hash = '...'
```

The `--` comments out the rest of the SQL line, so the password condition is ignored.

---

### SQL Injection in Add Customer

The vulnerable Add Customer flow inserts customer input directly into SQL.

Example:

```js
const insertCustomerSql = `
  INSERT INTO customers (full_name, email, phone, sector_id, package_id)
  VALUES ('${fullName}', '${email}', '${phone}', ${sectorId}, ${packageId})
`;
```

A quote-based payload can break or alter the SQL query.

---

### Stored XSS in Customers Table

The vulnerable version renders customer names using unsafe EJS rendering:

```ejs
<%- customer.full_name %>
```

Payload example:

```html
<script>alert("XSS")</script>
```

When this value is saved in the database and displayed in the Customers table, the script executes in the browser.

---

## How To Run

### Secure Version

```bash
cd secure-version
npm install
cp .env.example .env
npm start
```

The secure version runs on:

```text
http://localhost:3000
```

---

### Vulnerable Version

```bash
cd vulnerable-version
npm install
cp .env.example .env
npm start
```

The vulnerable version runs on:

```text
http://localhost:3001
```

---

## Environment Variables

Each version requires a `.env` file.

Example:

```env
PORT=3000
SESSION_SECRET=change_this_session_secret
HMAC_SECRET=change_this_hmac_secret
```

The real `.env` file should not be committed to GitHub.

Use `.env.example` as a template.

---

## Database

Each version uses its own SQLite database.

| Version            | Database                                                      |
| ------------------ | ------------------------------------------------------------- |
| secure-version     | `secure-version/database/communication_ltd_secure.db`         |
| vulnerable-version | `vulnerable-version/database/communication_ltd_vulnerable.db` |

The databases are separated so vulnerable demo data does not affect the secure version.

The database tables are created automatically when the server starts.

Main tables:

* users
* password_history
* password_reset_tokens
* internet_packages
* sectors
* subscription_requests
* customers

---

## Database Scripts

The project includes SQL scripts under:

```text
database-scripts/
├── schema.sql
├── seed.sql
└── reset.sql
```

### Files

| File         | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `schema.sql` | Creates all database tables                            |
| `seed.sql`   | Inserts default sectors and internet packages          |
| `reset.sql`  | Clears demo data and restores default sectors/packages |

The application also creates the database automatically on startup, but these scripts are included for documentation and manual setup.

---

### Manual Secure Database Setup

```bash
sqlite3 secure-version/database/communication_ltd_secure.db < database-scripts/schema.sql
sqlite3 secure-version/database/communication_ltd_secure.db < database-scripts/seed.sql
```

---

### Manual Vulnerable Database Setup

```bash
sqlite3 vulnerable-version/database/communication_ltd_vulnerable.db < database-scripts/schema.sql
sqlite3 vulnerable-version/database/communication_ltd_vulnerable.db < database-scripts/seed.sql
```

---

### Reset Secure Demo Data

```bash
sqlite3 secure-version/database/communication_ltd_secure.db < database-scripts/reset.sql
```

---

### Reset Vulnerable Demo Data

```bash
sqlite3 vulnerable-version/database/communication_ltd_vulnerable.db < database-scripts/reset.sql
```

---

## Database Schema Summary

### Main Tables

| Table                   | Purpose                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `users`                 | Stores registered users, roles, password hashes, salts, lockout data and assigned package |
| `password_history`      | Stores previous password hashes to prevent password reuse                                 |
| `password_reset_tokens` | Stores reset tokens, expiry time and usage state                                          |
| `internet_packages`     | Stores available internet packages                                                        |
| `sectors`               | Stores customer sectors                                                                   |
| `subscription_requests` | Stores package subscription requests                                                      |
| `customers`             | Stores customer records managed by admin                                                  |

### Important User Columns

| Column            | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `username`        | Login username                               |
| `email`           | User email                                   |
| `password_hash`   | HMAC-SHA256 password hash                    |
| `salt`            | Random salt                                  |
| `role`            | User role: admin, employee, viewer, customer |
| `package_id`      | Assigned internet package                    |
| `failed_attempts` | Failed login counter                         |
| `locked_until`    | Temporary account lock timestamp             |

---

## Manual Admin Setup

After registering an admin user, promote it manually in SQLite.

Secure database:

```bash
sqlite3 secure-version/database/communication_ltd_secure.db
```

Then run:

```sql
UPDATE users
SET role = 'admin'
WHERE username = 'admin';
```

Vulnerable database:

```bash
sqlite3 vulnerable-version/database/communication_ltd_vulnerable.db
```

Then run:

```sql
UPDATE users
SET role = 'admin'
WHERE username = 'admin';
```

---

## Demo Checklist

### Secure Version

* Register with a strong password
* Login with correct credentials
* Login with SQL Injection payload and verify failure
* Add customer with SQL Injection payload and verify safe handling
* Add XSS payload and verify it does not execute
* Change password
* Reset password using SHA1 token
* Viewer requests a package
* Admin approves the request
* Viewer becomes customer
* Customer sees active package
* Customer disconnects from service and returns to viewer

---

### Vulnerable Version

* Login SQL Injection using:

```text
admin' --
```

* Register SQL Injection using:

```text
' OR '1'='1' --
```

* Add Customer SQL Injection using a quote-based payload
* Stored XSS using:

```html
<script>alert("XSS")</script>
```

---

## Security Comparison

| Topic            | Vulnerable Version        | Secure Version                  |
| ---------------- | ------------------------- | ------------------------------- |
| Register SQL     | String concatenation      | Parameterized queries           |
| Login SQL        | String concatenation      | Parameterized query + Salt/HMAC |
| Add Customer SQL | String concatenation      | Parameterized queries           |
| XSS Rendering    | `<%- %>` unsafe rendering | `<%= %>` escaped rendering      |
| Password Storage | Salt + HMAC               | Salt + HMAC                     |
| Roles            | Implemented               | Implemented                     |
| Database         | Separate vulnerable DB    | Separate secure DB              |

---

## Academic Requirements Coverage

| Requirement                                     | Implementation                    |
| ----------------------------------------------- | --------------------------------- |
| Register screen                                 | Implemented in both versions      |
| Complex password policy                         | Implemented in secure version     |
| Salt + HMAC                                     | Implemented                       |
| User email                                      | Implemented                       |
| Login screen                                    | Implemented                       |
| Change password                                 | Implemented                       |
| Forgot password                                 | Implemented as demo token flow    |
| SHA1 reset token                                | Implemented                       |
| System screen / Add Customer                    | Implemented                       |
| Stored XSS demonstration                        | Implemented in vulnerable version |
| SQL Injection in Register                       | Implemented in vulnerable version |
| SQL Injection in Login                          | Implemented in vulnerable version |
| SQL Injection in Add Customer                   | Implemented in vulnerable version |
| XSS protection using special character encoding | Implemented in secure version     |
| SQL Injection protection using parameters       | Implemented in secure version     |

---

## Important Notes

The vulnerable version is intentionally insecure and must be used only for local academic demonstration.

It should not be deployed or used in a real environment.

The `.env` files and SQLite database files should not be committed to GitHub.

Only `.env.example` and SQL scripts should be committed.
