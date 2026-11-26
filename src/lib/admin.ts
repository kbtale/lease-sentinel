export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  const allowlist = getAdminEmails();
  if (allowlist.length === 0) {
    return false;
  }
  return allowlist.includes(email.trim().toLowerCase());
}
