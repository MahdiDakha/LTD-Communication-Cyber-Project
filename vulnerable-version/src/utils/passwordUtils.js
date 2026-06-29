import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Shared helper used by the vulnerable demo for flows that still keep the same
// password-change and reset mechanics as the secure build.
export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function createPasswordHash(password, salt) {
  return crypto
    .createHmac("sha256", process.env.HMAC_SECRET)
    .update(password + salt)
    .digest("hex");
}

export function verifyPassword(password, salt, storedHash) {
  const newHash = createPasswordHash(password, salt);

  // timingSafeEqual is still used here; the demo vulnerabilities live in how
  // SQL is built and how login is queried, not in this comparison helper.
  return crypto.timingSafeEqual(
    Buffer.from(newHash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

// Password reset tokens are generated separately from password hashes so the
// reset flow can stay readable during the security comparison.
export function generateSha1Token() {
  const randomValue = crypto.randomBytes(32).toString("hex");

  return crypto
    .createHash("sha1")
    .update(randomValue)
    .digest("hex");
}
