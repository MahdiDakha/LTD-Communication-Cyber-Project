// One central policy object keeps registration, login throttling and password
// reset rules aligned across the auth flows.
const passwordConfig = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  passwordHistoryLimit: 3,
  maxLoginAttempts: 3,
  forbiddenWords: [
    "password",
    "123456",
    "qwerty",
    "admin",
    "user",
    "ltd",
    "communication"
  ]
};

export default passwordConfig;
