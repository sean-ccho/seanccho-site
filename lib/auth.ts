/** 'Authorization: Basic base64(아이디:비밀번호)' 의 비밀번호가 SITE_PASSWORD 와 같은지 (아이디는 아무거나).
 *  비밀번호가 설정돼 있지 않으면 언제나 false — 내계좌는 비밀번호 없이는 열리지 않는다. */
export function basicAuthOk(header: string | null, password: string | undefined): boolean {
  if (!password) return false;
  const [scheme, encoded] = (header ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded: Uint8Array;
  try {
    decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const colon = decoded.indexOf(0x3a);
  return sameBytes(decoded.subarray(colon + 1), new TextEncoder().encode(password));
}

/** 길이가 같으면 끝까지 다 비교한다 (어디서 틀렸는지 시간으로 새지 않게). */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
