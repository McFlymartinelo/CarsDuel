import type { PoolClient } from "pg";
import type { OtpPurpose } from "./otp-token";

/**
 * Persistance des codes OTP (`public.email_otps`), accessible uniquement via
 * `withAdmin`. Un seul code actif par `(user_id, purpose)` grâce à l'upsert.
 */

export interface OtpRow {
  user_id: string;
  email: string;
  purpose: OtpPurpose;
  code_hash: string;
  expires_at: string;
  attempts: number;
  created_at: string;
}

export interface IssueOtpInput {
  userId: string;
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  createdAt?: Date;
}

export async function issueOtp(c: PoolClient, input: IssueOtpInput): Promise<void> {
  await c.query(
    `insert into email_otps (user_id, email, purpose, code_hash, expires_at, attempts, created_at)
     values ($1, $2, $3, $4, $5, 0, $6)
     on conflict (user_id, purpose) do update set
       email = excluded.email,
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = excluded.created_at`,
    [
      input.userId,
      input.email,
      input.purpose,
      input.codeHash,
      input.expiresAt,
      input.createdAt ?? new Date(),
    ],
  );
}

export async function getOtp(
  c: PoolClient,
  userId: string,
  purpose: OtpPurpose,
): Promise<OtpRow | null> {
  const { rows } = await c.query<OtpRow>(
    `select user_id, email, purpose, code_hash, expires_at, attempts, created_at
       from email_otps where user_id = $1 and purpose = $2
       for update`,
    [userId, purpose],
  );
  return rows[0] ?? null;
}

export async function deleteOtp(c: PoolClient, userId: string, purpose: OtpPurpose): Promise<void> {
  await c.query("delete from email_otps where user_id = $1 and purpose = $2", [userId, purpose]);
}

export async function setOtpAttempts(
  c: PoolClient,
  userId: string,
  purpose: OtpPurpose,
  attempts: number,
): Promise<void> {
  await c.query("update email_otps set attempts = $3 where user_id = $1 and purpose = $2", [
    userId,
    purpose,
    attempts,
  ]);
}

export async function purgeExpiredOtps(c: PoolClient): Promise<void> {
  await c.query("delete from email_otps where expires_at < now()");
}
