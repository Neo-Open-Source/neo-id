import { useState } from 'react'

export interface SecurityProfile {
  totp_enabled?: boolean
  email_mfa_enabled?: boolean
  display_name?: string
  email?: string
  first_name?: string
  last_name?: string
  email_verified?: boolean
  pending_email?: string
}

export interface SecurityPasskey {
  id: string
  name: string
  credential_id: string
  created_at?: string
}

export interface SecurityPasskeyPublicKeyOptions {
  rp: PublicKeyCredentialRpEntity
  challenge: string
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: PublicKeyCredentialParameters[]
  authenticatorSelection?: AuthenticatorSelectionCriteria
  timeout?: number
  attestation?: AttestationConveyancePreference
  excludeCredentials?: Array<{ id: string; type: string }>
}

export type SecurityModal =
  | 'name'
  | 'email'
  | 'emailVerify'
  | 'linked'
  | 'passkeys'
  | 'passkeyVerify'
  | 'activity'
  | 'password'
  | 'totp'
  | 'emailMfa'
  | null

export function useSecuritySectionState(profile?: SecurityProfile, providersCount = 0) {
  const isEmailVerified = !!profile?.email_verified
  const fullName = [profile?.first_name, profile?.last_name].map(v => (v || '').trim()).filter(Boolean).join(' ')
  const preferredName = fullName || profile?.display_name || profile?.email || 'Not set'
  const linkedCount = providersCount

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [pwdMfaStep, setPwdMfaStep] = useState<'totp' | 'email' | null>(null)
  const [pwdMfaCode, setPwdMfaCode] = useState('')
  const [pwdMfaLoading, setPwdMfaLoading] = useState(false)
  const [activeModal, setActiveModal] = useState<SecurityModal>(null)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [firstName, setFirstName] = useState(profile?.first_name || '')
  const [lastName, setLastName] = useState(profile?.last_name || '')
  const [nameSaving, setNameSaving] = useState(false)
  const [emailValue, setEmailValue] = useState(profile?.pending_email || profile?.email || '')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passkeys, setPasskeys] = useState<SecurityPasskey[]>([])
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')
  const [passkeyMFACode, setPasskeyMFACode] = useState('')
  const [passkeyCodeSending, setPasskeyCodeSending] = useState(false)
  const [passkeyVerifyLoading, setPasskeyVerifyLoading] = useState(false)
  const [passkeyCreationOptions, setPasskeyCreationOptions] = useState<SecurityPasskeyPublicKeyOptions | null>(null)

  const passkeyEnforcedMethod: 'totp' | 'email' = profile?.totp_enabled ? 'totp' : 'email'
  const passkeyRequiresMFA = !!profile?.totp_enabled || !!profile?.email_mfa_enabled
  const normalizedCurrentEmail = (profile?.email || '').trim().toLowerCase()
  const normalizedEmailInput = emailValue.trim().toLowerCase()
  const isSameEmail = !!normalizedCurrentEmail && normalizedEmailInput !== '' && normalizedEmailInput === normalizedCurrentEmail
  const canSendEmailChange = normalizedEmailInput.length > 0 && !isSameEmail && !emailLoading

  return {
    isEmailVerified,
    preferredName,
    linkedCount,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    currentPassword, setCurrentPassword,
    pwdMfaStep, setPwdMfaStep,
    pwdMfaCode, setPwdMfaCode,
    pwdMfaLoading, setPwdMfaLoading,
    activeModal, setActiveModal,
    displayName, setDisplayName,
    firstName, setFirstName,
    lastName, setLastName,
    nameSaving, setNameSaving,
    emailValue, setEmailValue,
    emailLoading, setEmailLoading,
    emailCode, setEmailCode,
    emailError, setEmailError,
    passkeys, setPasskeys,
    passkeyLoading, setPasskeyLoading,
    passkeyName, setPasskeyName,
    passkeyMFACode, setPasskeyMFACode,
    passkeyCodeSending, setPasskeyCodeSending,
    passkeyVerifyLoading, setPasskeyVerifyLoading,
    passkeyCreationOptions, setPasskeyCreationOptions,
    passkeyEnforcedMethod,
    passkeyRequiresMFA,
    isSameEmail,
    canSendEmailChange,
  }
}

