import { z } from "zod";
import { PASSWORD, USER, EMAIL } from "./constants";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(USER.USERNAME_MIN, `Username must be at least ${USER.USERNAME_MIN} characters`)
    .max(USER.USERNAME_MAX, `Username must be at most ${USER.USERNAME_MAX} characters`)
    .regex(USER.USERNAME_REGEX, "Only Latin letters, numbers, - and _ allowed"),
  password: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password must be at most ${PASSWORD.MAX_LENGTH} characters`),
  displayName: z.string().max(USER.DISPLAY_NAME_MAX).optional(),
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you are 16 or older" }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyForgotPasswordMfaSchema = z.object({
  email: z.string().email("Invalid email address"),
  method: z.enum(["totp", "email", "passkey"]),
  code: z.string().min(1).optional(),
  response: z.any().optional(),
  expectedChallenge: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH),
});

// ─── MFA ─────────────────────────────────────────────────────────────────────

export const mfaVerifySchema = z.object({
  code: z.string().length(EMAIL.CODE_LENGTH, `Code must be ${EMAIL.CODE_LENGTH} digits`),
});

export const totpSetupSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
  secret: z.string().min(1),
});

// ─── Profile ─────────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().max(USER.DISPLAY_NAME_MAX).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  username: z
    .union([
      z
        .string()
        .min(USER.USERNAME_MIN, `Username must be at least ${USER.USERNAME_MIN} characters`)
        .max(USER.USERNAME_MAX, `Username must be at most ${USER.USERNAME_MAX} characters`)
        .regex(USER.USERNAME_REGEX, "Only Latin letters, numbers, - and _ allowed"),
      z.literal(""),
    ])
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH),
});

export const requestProfilePasswordResetSchema = z.object({});

export const verifyProfilePasswordResetSchema = z.object({
  method: z.enum(["totp", "email", "passkey"]),
  code: z.string().min(1).optional(),
  response: z.any().optional(),
  expectedChallenge: z.string().optional(),
  newPassword: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(EMAIL.CODE_LENGTH),
});

// ─── Service App ─────────────────────────────────────────────────────────────

export const createServiceAppSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).min(1, "At least one redirect URI required"),
});

export const updateServiceAppSchema = z.object({
  displayName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).optional(),
});

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminBanUserSchema = z.object({
  userId: z.string().min(1),
  banned: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const adminSetRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["user", "developer", "admin"]),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestProfilePasswordResetInput = z.infer<typeof requestProfilePasswordResetSchema>;
export type VerifyProfilePasswordResetInput = z.infer<typeof verifyProfilePasswordResetSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type CreateServiceAppInput = z.infer<typeof createServiceAppSchema>;
export type UpdateServiceAppInput = z.infer<typeof updateServiceAppSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyForgotPasswordMfaInput = z.infer<typeof verifyForgotPasswordMfaSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
