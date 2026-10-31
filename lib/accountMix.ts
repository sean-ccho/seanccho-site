import type { AccountRow } from "./account";
import type { EtfDetail, EtfItem } from "./etf";
import { isCadListing } from "./format";
import { BROAD_GROUPS } from "./sectorMap";
import { QUADS, quadOf, type Quad } from "./stockStyle";
import type { TickerInfo } from "./types";

// 내 계좌 쏠림 (2026-10-30) — 보유 종목 + ETF 속 종목까지 풀어서 4칸(경기순환/방어 × 내수/글로벌)과 섹터 비중.
// 서버에서만 계산한다 (보유 목록을 밖으로 내보내지 않는다). 분산 점검용 — 칸을 고르게 맞추면 수익이 오른다는 검증은 아니다.

export type MixKey = Quad | "other";
export type MixPart = { key: string; value: number; share: number };

export type AccountMix = {
  total: number; // USD
  quads: MixPart[]; // 4칸 (사용자 표 순서) + other
  sectors: MixPart[]; // 큰 순, other 는 맨 뒤
  etfCount: number; // 속을 풀어 본 ETF 수
  cadSkipped: boolean; // 환율이 없어 CAD 종목을 뺐다
  usdcad: number | null;
};

export const QUAD_HEAVY = 0.6; // 한 칸이 이 이상이면 '쏠림'
export const QUAD_THIN = 0.1; // 이보다 적은 칸은 '비어 있음' — 채울 ETF 를 보여 준다
export const SECTOR_HEAVY = 0.35;
export const FILL_MIN = 0.4; // 채울 ETF — 그 칸 비중이 이 이상인 것만
export const FILL_DEF_BETA = 0.8; // 방어 칸을 채울 ETF — 시장 민감도(베타)가 이 이하인 것만

/** 계좌 티커 → ETF 목록 티커 (캐나다 상장인데 '.TO' 가 없으면 붙인다). */
export function etfKey(r: AccountRow): string {
  const tk = r.input.ticker.trim().toUpperCase();
  return isCadListing(tk, r.input.exchange) && !tk.includes(".") ? `${tk}.TO` : tk;
}

function add(m: Map<string, number>, k: string, v: number) {
  if (v > 0) m.set(k, (m.get(k) ?? 0) + v);
}

export function accountMix(
  rows: AccountRow[],
  site: Record<string, TickerInfo>,
  etfs: Record<string, EtfItem>,
  details: Record<string, EtfDetail | null>,
  usdcad: number | null,
): AccountMix | null {
  const quads = new Map<string, number>();
  const sectors = new Map<string, number>();
  let total = 0;
  let etfCount = 0;
  let cadSkipped = false;
  for (const r of rows) {
    if (r.closed || r.sample || r.shares == null || r.price == null || r.shares <= 0) continue;
    const cad = isCadListing(r.input.ticker, r.input.exchange);
    if (cad && !usdcad) {
      cadSkipped = true;
      continue;
    }
    const v = (r.shares * r.price) / (cad ? (usdcad as number) : 1);
    total += v;
    const etf = etfs[etfKey(r)];
    if (etf) {
      etfCount += 1;
      const m = etf.style_mix;
      const known = m ? v * Math.min(1, m.covered) : 0;
      if (m) for (const [q, w] of Object.entries(m.mix)) add(quads, q, known * w);
      add(quads, "other", v - known);
      const d = details[etf.ticker];
      const stock = d?.assets ? d.assets.stock : 1;
      const secs = Object.entries(d?.sectors ?? {});
      const secSum = secs.reduce((a, [, w]) => a + w, 0);
      for (const [s, w] of secs) add(sectors, s, (v * stock * w) / (secSum > 1 ? secSum : 1));
      add(sectors, "other", v - (secs.length ? v * stock * Math.min(1, secSum) : 0));
    } else {
      const info = site[r.input.ticker.trim().toUpperCase()];
      add(quads, quadOf(info?.style) ?? "other", v);
      add(sectors, info?.sector ?? "other", v);
    }
  }
  if (total <= 0) return null;
  const part = (k: string, m: Map<string, number>) => ({ key: k, value: m.get(k) ?? 0, share: (m.get(k) ?? 0) / total });
  const secParts = [...sectors.keys()].filter((k) => k !== "other").map((k) => part(k, sectors))
    .sort((a, b) => b.value - a.value);
  return {
    total,
    quads: [...QUADS, "other"].map((k) => part(k, quads)),
    sectors: sectors.has("other") ? [...secParts, part("other", sectors)] : secParts,
    etfCount,
    cadSkipped,
    usdcad,
  };
}

/**
 * 비어 있는 칸(QUAD_THIN 미만)마다 그 칸을 많이 담은 ETF — 그 칸 비중 FILL_MIN 이상, 시장 전체 ETF 는 빼고, 그 칸 비중 큰 순.
 * 방어 칸은 베타(1년 상관 × 63일 변동성 ÷ SPY 변동성) FILL_DEF_BETA 이하만 — 바이오(XBI 1.4)처럼 업종은 '방어'여도 시장과
 * 크게 같이 흔들리는 ETF 는 방어로 안 권한다. (변동성만 보면 SPY 가 조용한 때 방어 ETF 가 다 빠졌다, 10-30)
 */
export function fillers(mix: AccountMix, etfs: EtfItem[], top = 3): { quad: Quad; etfs: { etf: EtfItem; share: number }[] }[] {
  const spyVol = etfs.find((e) => e.ticker === "SPY")?.vol ?? null;
  const beta = (e: EtfItem) => (spyVol && e.vol != null && e.corr_spy != null ? (e.corr_spy * e.vol) / spyVol : null);
  return mix.quads
    .filter((p): p is MixPart & { key: Quad } => p.key !== "other" && p.share < QUAD_THIN)
    .map((p) => ({
      quad: p.key,
      etfs: etfs
        .filter((e) => !BROAD_GROUPS.has(e.group) && (e.style_mix?.mix[p.key] ?? 0) >= FILL_MIN)
        .filter((e) => !p.key.startsWith("defensive") || (beta(e) ?? Infinity) <= FILL_DEF_BETA)
        .map((e) => ({ etf: e, share: e.style_mix!.mix[p.key] }))
        .sort((a, b) => b.share - a.share || (b.etf.aum ?? 0) - (a.etf.aum ?? 0))
        .slice(0, top),
    }));
}
