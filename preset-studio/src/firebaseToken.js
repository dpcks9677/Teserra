const PROJECT_ID = 'augmented-dice';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
let certificatesPromise;

function decodePart(value) {
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0))));
}

async function getCertificates() {
  certificatesPromise ||= fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com').then(async (response) => {
    if (!response.ok) throw new Error('FIREBASE_CERTIFICATES_UNAVAILABLE');
    const body = await response.json();
    return Object.fromEntries(body.keys.map((key) => [key.kid, key]));
  });
  return certificatesPromise;
}

export async function verifyFirebaseIdToken(token) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('INVALID_ID_TOKEN');
  const header = decodePart(encodedHeader);
  const payload = decodePart(encodedPayload);
  if (header.alg !== 'RS256' || payload.aud !== PROJECT_ID || payload.iss !== ISSUER || !payload.sub) {
    throw new Error('INVALID_ID_TOKEN');
  }
  if (Number(payload.exp) <= Math.floor(Date.now() / 1000)) throw new Error('EXPIRED_ID_TOKEN');
  const certificates = await getCertificates();
  const jwk = certificates[header.kid];
  if (!jwk) throw new Error('UNKNOWN_ID_TOKEN_KEY');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = Uint8Array.from(atob(encodedSignature.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)) throw new Error('INVALID_ID_TOKEN');
  return payload;
}
