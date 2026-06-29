import passwordConfig from "../config/passwordConfig.js";

// Password rules are driven by config so the UI and backend can evolve without
// scattering hard-coded checks through the controllers.
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < passwordConfig.minLength) {
    errors.push(`Password must be at least ${passwordConfig.minLength} characters long`);
  }

  if (passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (passwordConfig.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (passwordConfig.requireSpecialChar && !/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  const lowerPassword = password.toLowerCase();

  for (const word of passwordConfig.forbiddenWords) {
    if (lowerPassword.includes(word.toLowerCase())) {
      errors.push(`Password must not contain the forbidden word: ${word}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Customer-facing text fields are also screened for obvious HTML/script
// payloads before they are saved or echoed back into templates.
export function containsUnsafeHtml(value) {
  if (!value) {
    return false;
  }

  const unsafePatterns = [
    /<[^>]*>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /onload\s*=/i,
    /script/i
  ];

  return unsafePatterns.some((pattern) => pattern.test(value));
}

export function validateCustomerInput({ fullName, email, phone }) {
  const errors = [];

  if (containsUnsafeHtml(fullName)) {
    errors.push("Customer name cannot contain HTML or script code");
  }

  if (containsUnsafeHtml(email)) {
    errors.push("Email cannot contain HTML or script code");
  }

  if (containsUnsafeHtml(phone)) {
    errors.push("Phone cannot contain HTML or script code");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
