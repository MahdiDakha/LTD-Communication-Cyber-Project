import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Each password gets its own random salt before hashing so identical passwords
// do not produce identical stored values.
export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

// The secure build derives password hashes from the plain password, a per-user
// salt and a server-side secret kept outside the database.
export function createPasswordHash(password, salt) {
  return crypto
    .createHmac("sha256", process.env.HMAC_SECRET)
    .update(password + salt)
    .digest("hex");
}

export function verifyPassword(password, salt, storedHash) {
  const newHash = createPasswordHash(password, salt);

  // timingSafeEqual avoids leaking partial-match timing information during
  // password comparison.
  return crypto.timingSafeEqual(
    Buffer.from(newHash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

// Reset links use a separate token generator so password reset secrets are not
// derived from the password hashing flow.
export function generateSha1Token() {
  const randomValue = crypto.randomBytes(32).toString("hex");

  return crypto
    .createHash("sha1")
    .update(randomValue)
    .digest("hex");
}
