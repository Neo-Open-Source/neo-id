import type { AxiosRequestConfig } from 'axios'

export type QueryParams = Record<string, string | number | boolean | undefined>

export type ApiRequestConfig = AxiosRequestConfig

export type ProfileUpdatePayload = {
  display_name?: string
  first_name?: string
  last_name?: string
  avatar?: string
}

export type CreatePasskeyPayload = {
  name: string
  credential_id: string
  public_key?: string
  transports?: string[]
  device_type?: string
}

export type RegisterServicePayload = {
  name: string
  domain: string
  owner_email: string
  webhook_url?: string
}

export type UpdateServicePayload = {
  site_id: string
  allowed_origins?: string[]
  webhook_url?: string
}

export type AdminUsersQuery = {
  page?: number
  limit?: number
  search?: string
  banned?: 'true' | 'false'
}

export type AdminClientPayload = {
  name: string
  redirect_uris: string[]
  logo_url?: string
  [key: string]: string | string[] | undefined
}

export type FinishPasskeyPayload = {
  name: string
  id: string
  rawId: string
  type: string
  response: {
    clientDataJSON: string
    attestationObject: string
    transports?: string[]
  }
}

export interface AvatarResponse {
  avatar: string
}

export interface AuthVerifyResponse {
  access_token: string
  refresh_token?: string
  site_id?: string
  redirect_url?: string
  site_state?: string
}
