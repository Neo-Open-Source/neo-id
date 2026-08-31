import bcrypt from "bcrypt";
import { PASSWORD } from "@neo-id/shared";

export async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD.SALT_ROUNDS);
}

export async function verify(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
