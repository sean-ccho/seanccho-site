import type { Metadata } from "next";
import Link from "next/link";
import { AccountMix } from "@/components/AccountMix";
import { AccountTabs } from "@/components/AccountTabs";
import { AccountView } from "@/components/AccountView";
import { AccountNews } from "@/components/NewsSection";
import type { StockHint } from "@/components/RiskPanel";
import { marketTicker, readAccount, type AccountRow } from "@/lib/account";
import { accountMix, etfKey, fillView } from "@/lib/accountMix";
import { withLiveClose } from "@/lib/bench";
import { getDashboard } from "@/lib/dashboard";
import { getEtf, getEtfDetail } from "@/lib/etf";
import { todayToronto } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getMacro } from "@/lib/macro";
import { checkReason, type ReasonCheck } from "@/lib/reasonCheck";
import { sheetsConfigured, spreadsheetUrl } from "@/lib/sheets";
import { siteStocks } from "@/lib/siteStocks";
import type { SqzInfo, StockStyle } from "@/lib/types";
import { NO_INDEX } from "@/lib/siteUrl";
import { requireAdmin } from "@/lib/viewer";

// 시트에서 고친 값이 새로고침하면 바로 보이도록 매번 시트를 읽는다 (캐시 없음)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.account.metaTitle, robots: NO_INDEX };
}

export default async function AccountPage() {
  // 실제 돈 — 관리자만 (구글 로그인 + DB 등급, lib/viewer.ts). 아니면 로그인 화면으로.
  await requireAdmin("/quant/account");
  const { lang, t } = await getT();
  const A = t.account;
  // 머리 (2026-11-26 사용자 시안) — 탭 줄 오른쪽에 분석 갱신 시각 · '관리 · 파이프라인', 그 아래 제목과 한 줄 설명
  const head = (updated?: string, samples = 0) => (
    <>
      <div className="acct-bar">
        <AccountTabs current="account" t={t} />
        <div className="acct-bar__meta">
          {updated && <span className="acct-bar__updated num" title={A.updatedTitle}>{A.updatedShort(updated)}</span>}
          {/* 관리 화면은 공개 메뉴에 없고 여기(관리자 화면)와 머리의 계정 메뉴에서 들어간다 */}
          <Link href="/quant/admin" prefetch={false} className="adm-lock" title={A.adminLinkTitle}>
            {A.adminLink} →
          </Link>
        </div>
      </div>
      <div className="acct-head">
        <h1>{A.title}</h1>
        <p>
          {A.sub}
          {samples > 0 && <span title={A.sampleTitle}> {A.subSample(samples)}</span>}
        </p>
      </div>
    </>
  );

  if (!sheetsConfigured()) {
    return (
      <main className="container container--wide page acct">
        {head()}
        <section className="card empty">
          <h2 style={{ fontSize: 18 }}>{A.notConfigured}</h2>
          <p style={{ margin: "8px 0 0" }}>{A.notConfiguredBody}</p>
        </section>
      </main>
    );
  }

  let rows;
  let spyLive: number | null = null;
  try {
    ({ rows, spyLive } = await readAccount());
  } catch (err) {
    console.error("[account] read", err);
    return (
      <main className="container container--wide page acct">
        {head()}
        <section className="card empty">
          <h2 style={{ fontSize: 18 }}>{A.loadFailed}</h2>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            {err instanceof Error ? err.message : String(err)}
          </p>
        </section>
      </main>
    );
  }

  const data = await getDashboard();
  const today = todayToronto();
  // 장중엔 시트 'SPY 실시간'을 오늘 종가처럼 붙여서, 실시간가로 계산한 수익률과 같은 시점의 SPY 와 비교한다
  const bench = withLiveClose(data?.benchmark ?? null, spyLive, today);
  // 보유 중인데 시트 현재가가 아직 없는 줄(웹에서 막 넣은 거래) → 사이트의 마지막 종가로 평가액·손익·리스크를 낸다
  // (샘플 줄은 합계에 안 들어가니 채우지 않는다)
  // 캐나다 거래소인데 접미사 없이 적은 줄은 .TO · .V 로 찾는다 (2026-11-18 — 'T' + TSX 가 AT&T 가격이었다)
  const mt = (r: AccountRow) => marketTicker(r.input.ticker, r.input.exchange);
  const site = await siteStocks(data, rows.filter((r) => !r.closed && !r.sample).map(mt));
  // 장중(2026-11-09) — 시트 '실시간가'(GOOGLEFINANCE)가 없으면 사이트 장중 펄스(15분) 가격 → 밤 '현재가' → 사이트 종가 순.
  // 사이트 종목 정보는 이미 장중 값(lib/live.ts)이라 그 종목이 장중 시세 대상이면 live 표시가 있다 (보유 목록은 밖으로 안 나간다)
  rows = rows.map((r) => {
    if (r.closed || r.sample) return r;
    const s = site[mt(r)];
    if (!r.priceSheetLive && s?.live && s.price != null) return { ...r, price: s.price, priceSite: false, priceLive: s.live };
    return r.price != null || s?.price == null ? r : { ...r, price: s.price, priceSite: true };
  });
  const open = rows.filter((r) => !r.closed && !r.sample);
  // 보유 종목 SQZ 모멘텀 일·주·월 (표시 전용) — 사이트가 이미 가진 종목 정보에서 꺼낸다 (보유 목록을 밖으로 내보내지 않는다)
  const sqz: Record<string, SqzInfo> = Object.fromEntries(
    Object.entries(site).flatMap(([tk, s]) => (s.sqzmom ? [[tk, s.sqzmom] as const] : [])),
  );
  // 보유 종목 경기순환/방어 · 내수/글로벌 (2026-11-26 — 표의 '순환' · '방어' 배지, 리스크 '가장 큰 종목' 아래 줄)
  const styles: Record<string, StockStyle> = Object.fromEntries(open.flatMap((r) => {
    const s = site[mt(r)]?.style;
    return s ? [[r.input.ticker.toUpperCase(), s] as const] : [];
  }));
  // 보유 종목 최근 분할 (2026-11-18) — 시트가 분할 전 기준이면 표에 ✂️ (보유 목록은 밖으로 안 나간다)
  const splits = Object.fromEntries(rows.flatMap((r) => {
    const s = site[mt(r)]?.split;
    return s ? [[r.input.ticker.toUpperCase(), s] as const] : [];
  }));
  // 계산기·리스크 패널용 — 대시보드에 있는 종목(후보·보유·차트)의 섹터·실적일·ATR·가격·경기 성격
  const hints: Record<string, StockHint> = Object.fromEntries(
    Object.entries({ ...site, ...data?.stocks }).map(([tk, s]) => [tk, {
      sector: s.sector, earnings: s.earnings_date, atr: s.atr_pct ?? null, price: s.price, move: s.earnings_move ?? null,
      cycle: s.style?.cycle ?? null,
    }]),
  );

  // 내 계좌 쏠림 — ETF 속 종목까지 풀어서 (서버에서만 계산, 카드에는 결과만 넘긴다)
  const [etf, macro] = await Promise.all([getEtf(), getMacro()]);
  const etfMap = Object.fromEntries((etf?.items ?? []).map((e) => [e.ticker, e]));
  const heldEtfs = [...new Set(open.map(etfKey).filter((k) => etfMap[k]))];
  const details = Object.fromEntries(await Promise.all(heldEtfs.map(async (k) => [k, await getEtfDetail(k)] as const)));
  const mix = accountMix(rows, site, etfMap, details, macro?.fx?.usdcad ?? null);

  // 2026-11-26 — 줄마다 1년 주봉 모양 · 1주당 1년 배당(ETF 는 ETF 탭 배당률 × 가격) · 매수 이유가 아직 맞나.
  // 모두 사이트가 이미 가진 종목 정보에서 꺼낸다 (보유 목록은 밖으로 안 나간다)
  const pt1 = data?.accounts.find((a) => a.key === "pt1") ?? null;
  const candidates = new Set((data?.candidates ?? []).map((c) => c.ticker.toUpperCase()));
  const sparks: Record<string, string> = {};
  const divs: Record<string, number> = {};
  const checks: Record<number, ReasonCheck> = {};
  for (const r of open) {
    const tk = r.input.ticker.toUpperCase();
    const s = site[mt(r)];
    if (s?.spark_w) sparks[tk] = s.spark_w;
    const e = etfMap[etfKey(r)];
    const etfPx = e?.price ?? r.price;
    const a = s?.fundamentals?.annual_dividend ?? (e?.yield != null && etfPx ? e.yield * etfPx : null);
    if (a != null && Number.isFinite(a) && a >= 0) divs[tk] = a;
    const c = checkReason({ ticker: mt(r), buyDate: r.input.buyDate, reason: r.input.reason }, { pt1, candidates, info: s ?? null });
    if (c) checks[r.row] = c;
  }

  // 분석 갱신 — 밤 파이프라인이 보유 줄 '업데이트' 칸에 쓴 가장 늦은 시각
  const updated = open.map((r) => r.updated).filter(Boolean).sort().at(-1);

  return (
    <main className="container container--wide page acct">
      {head(updated, rows.filter((r) => r.sample).length)}
      <AccountView rows={rows} sheetUrl={spreadsheetUrl()} bench={bench} fx={macro?.fx ?? null} splits={splits}
        hints={hints} sqz={sqz} styles={styles} today={today} sparks={sparks} sparkEnd={data?.bar_date ?? today} divs={divs} checks={checks}
        mix={mix ? <AccountMix mix={mix} fill={fillView(mix, etf?.items ?? [])} /> : null}
        news={<AccountNews rows={rows} lang={lang} t={t} />} />
    </main>
  );
}
