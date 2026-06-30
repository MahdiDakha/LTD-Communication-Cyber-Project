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