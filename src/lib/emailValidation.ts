const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the value is shaped like an email address (trimmed). */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
