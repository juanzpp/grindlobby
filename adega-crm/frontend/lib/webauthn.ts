export function b64urlToBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bufferToB64url(value: ArrayBuffer | ArrayBufferView): string {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

type CredentialDescriptorJSON = { type: PublicKeyCredentialType; id: string };

export type PasskeyLoginOptionsJSON = Omit<PublicKeyCredentialRequestOptions, 'challenge' | 'allowCredentials'> & {
  challenge: string;
  allowCredentials?: CredentialDescriptorJSON[];
};

export type PasskeyRegisterOptionsJSON = Omit<PublicKeyCredentialCreationOptions, 'challenge' | 'user' | 'excludeCredentials'> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  excludeCredentials?: CredentialDescriptorJSON[];
};

export async function requestPlatformPasskey(options: PasskeyLoginOptionsJSON) {
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: b64urlToBuffer(options.challenge),
      allowCredentials: (options.allowCredentials || []).map(c => ({ ...c, id: b64urlToBuffer(c.id) })),
    },
  });
  if (!(credential instanceof PublicKeyCredential)) throw new Error('O dispositivo não retornou uma passkey válida.');
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    credential_id: bufferToB64url(credential.rawId),
    client_data_json: bufferToB64url(response.clientDataJSON),
    authenticator_data: bufferToB64url(response.authenticatorData),
    signature: bufferToB64url(response.signature),
  };
}

export async function createPlatformPasskey(options: PasskeyRegisterOptionsJSON) {
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: b64urlToBuffer(options.challenge),
      user: { ...options.user, id: b64urlToBuffer(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map(c => ({ ...c, id: b64urlToBuffer(c.id) })),
    },
  });
  if (!(credential instanceof PublicKeyCredential)) throw new Error('O dispositivo não criou uma passkey válida.');
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    credential_id: bufferToB64url(credential.rawId),
    client_data_json: bufferToB64url(response.clientDataJSON),
    attestation_object: bufferToB64url(response.attestationObject),
  };
}
