PRAGMA foreign_keys = OFF;

DELETE FROM password_reset_tokens;
DELETE FROM password_history;
DELETE FROM subscription_requests;
DELETE FROM customers;
DELETE FROM users;
DELETE FROM internet_packages;
DELETE FROM sectors;

DELETE FROM sqlite_sequence
WHERE name IN (
  'password_reset_tokens',
  'password_history',
  'subscription_requests',
  'customers',
  'users',
  'internet_packages',
  'sectors'
);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO sectors (sector_name)
VALUES
  ('Private'),
  ('Business'),
  ('Student'),
  ('Government');

INSERT OR IGNORE INTO internet_packages (package_name, speed, price)
VALUES
  ('Basic Internet', '100MB', 79.90),
  ('Advanced Internet', '500MB', 119.90),
  ('Fiber Max', '1000MB', 149.90);