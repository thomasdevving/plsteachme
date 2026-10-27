import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "plsteach-password-recovery";
function signature(value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Account storage is not configured");
  return createHmac("sha256", secret)
    .update(`password-recovery:${value}`)
    .digest("hex");
}
export function recoveryProof(
  userId: string,
  expires = Date.now() + 10 * 60_000,
) {
  const value = `${userId}.${expires}`;
  return `${value}.${signature(value)}`;
}
export function validRecoveryProof(
  proof: string | undefined,
  userId: string,
  now = Date.now(),
) {
  if (!proof) return false;
  const [id, expires, mac, extra] = proof.split(".");
  if (
    extra ||
    id !== userId ||
    !/^\d+$/.test(expires || "") ||
    Number(expires) <= now ||
    Number(expires) > now + 10 * 60_000 ||
    !/^[a-f0-9]{64}$/.test(mac || "")
  )
    return false;
  return timingSafeEqual(
    Buffer.from(mac, "hex"),
    Buffer.from(signature(`${id}.${expires}`), "hex"),
  );
}
export async function allowPasswordReset(userId: string) {
  (await cookies()).set(COOKIE, recoveryProof(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}
export async function passwordResetAllowed(userId: string) {
  return validRecoveryProof((await cookies()).get(COOKIE)?.value, userId);
}
export async function clearPasswordReset() {
  (await cookies()).delete(COOKIE);
}
