import * as opaque from '@serenity-kit/opaque';
import { ApiError } from './api';

export type RegistrationStart = { state: string; request: string };
export type LoginStart = { state: string; request: string };

export async function registerStart(password: string): Promise<RegistrationStart> {
  await opaque.ready;
  const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({
    password
  });
  return { state: clientRegistrationState, request: registrationRequest };
}

export async function registerFinish(
  password: string,
  state: string,
  response: string
): Promise<string> {
  await opaque.ready;
  const { registrationRecord } = opaque.client.finishRegistration({
    clientRegistrationState: state,
    registrationResponse: response,
    password
  });
  return registrationRecord;
}

export async function loginStart(password: string): Promise<LoginStart> {
  await opaque.ready;
  const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password });
  return { state: clientLoginState, request: startLoginRequest };
}

export async function loginFinish(
  password: string,
  state: string,
  response: string
): Promise<{ finalization: string; sessionKey: string }> {
  await opaque.ready;
  const result = opaque.client.finishLogin({
    clientLoginState: state,
    loginResponse: response,
    password
  });
  if (!result) throw new ApiError('INVALID_CREDENTIALS', 'invalid credentials', 401);
  return { finalization: result.finishLoginRequest, sessionKey: result.sessionKey };
}
