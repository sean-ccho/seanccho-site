import { createSign } from "node:crypto";

// Google Sheets REST — googleapis 패키지 없이 서비스 계정 JSON 으로 토큰을 받아 values API 를 부른다.
// 환경변수: GOOGLE_SERVICE_ACCOUNT_JSON (Project_1 CI 와 같은 서비스 계정), GOOGLE_SHEETS_SPREADSHEET_ID (선택).

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
// Project_1 src/screener/config.py 의 GOOGLE_SHEETS_SPREADSHEET_ID
const DEFAULT_SPREADSHEET_ID = "1VxzTPfDvRX0UGJZcNnRsqTRex4gqmjv4P-1I_VcuXaw";

export class SheetsError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function spreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
}

export function spreadsheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit`;
}

/** SHEETS_API_BASE 는 로컬 시험에서 가짜 서버로 바꿀 때만 쓴다. */
function apiBase(): string {
  return process.env.SHEETS_API_BASE || "https://sheets.googleapis.com/v4";
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    return sa.client_email && sa.private_key ? (sa as ServiceAccount) : null;
  } catch {
    return null;
  }
}

export function sheetsConfigured(): boolean {
  return serviceAccount() !== null;
}

let cachedToken: { value: string; exp: number } | null = null;

/** 서비스 계정 JWT(RS256) → OAuth 액세스 토큰. 만료 1분 전까지 다시 쓴다. */
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;
  const sa = serviceAccount();
  if (!sa) throw new SheetsError("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const aud = sa.token_uri || DEFAULT_TOKEN_URI;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: SCOPE, aud, iat: now, exp: now + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new SheetsError(`token ${res.status} ${body.error_description ?? body.error ?? ""}`.trim(), res.status);
  }
  cachedToken = { value: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return cachedToken.value;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${apiBase()}/spreadsheets/${spreadsheetId()}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new SheetsError(body.error?.message ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

const enc = encodeURIComponent;

/** 숫자는 숫자로, 날짜는 시트에 보이는 글자로. */
export async function readValues(range: string): Promise<unknown[][]> {
  const r = await call<{ values?: unknown[][] }>(
    `/values/${enc(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  );
  return r.values ?? [];
}

/** 여러 범위를 한 번에 쓴다 (사람이 입력한 것처럼 — 숫자·날짜를 시트가 알아서 해석). */
export async function writeValues(data: { range: string; values: unknown[][] }[]): Promise<void> {
  await call("/values:batchUpdate", { method: "POST", body: { valueInputOption: "USER_ENTERED", data } });
}

/** 표 끝에 줄을 붙인다. */
export async function appendRow(range: string, values: unknown[]): Promise<void> {
  await call(`/values/${enc(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: { values: [values] },
  });
}

export async function clearRanges(ranges: string[]): Promise<void> {
  await call("/values:batchClear", { method: "POST", body: { ranges } });
}

/** 탭 이름 → 숫자 sheetId (줄 지우기에 필요). */
export async function sheetIdOf(title: string): Promise<number | null> {
  const r = await call<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
    `?fields=${enc("sheets.properties(sheetId,title)")}`,
  );
  return r.sheets?.find((s) => s.properties.title === title)?.properties.sheetId ?? null;
}

/** 줄 하나를 통째로 지운다 (아래 줄이 한 칸씩 올라온다). row 는 1부터. */
export async function deleteRow(sheetId: number, row: number): Promise<void> {
  await call(":batchUpdate", {
    method: "POST",
    body: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }] },
  });
}
