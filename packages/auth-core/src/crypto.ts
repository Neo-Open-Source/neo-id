import { randomBytes, createHash } from "crypto";
import { v4 as uuid } from "uuid";

export function generateToken(length = 64): string {
  return randomBytes(length).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateId(): string {
  return uuid();
}

export function generateCode(length = 6): string {
  const digits = "0123456789";
  let code = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += digits[bytes[i]! % 10];
  }
  return code;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
