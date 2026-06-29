// Even the vulnerable demo reuses the same password policy object so the
// intentionally unsafe behavior stands out in the implementation itself.
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
