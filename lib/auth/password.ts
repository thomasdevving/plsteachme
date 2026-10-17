export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_HINT =
  "Use at least 12 characters. A few unrelated words work well.";

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return "Use a password with at least 12 characters.";
  // Supabase uses bcrypt: never silently truncate multibyte passwords.
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES)
    return "Use a shorter password (up to 72 bytes; emoji and some letters use more than one).";
  return null;
}
