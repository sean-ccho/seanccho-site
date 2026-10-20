import { pct, pp, tone, usd } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Dashboard } from "@/lib/types";

function arrow(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) || v === 0 ? "" : v > 0 ? "▲ " : "▼ ";
}

/** 머리글 아래 한 줄 — SPY 종가 · PT-1 $5,000 계좌 · SPY 대비 · 보유 칸 · 숏스퀴즈 (전부 dashboard.json 값). */
export function TickerTape({ data, t }: { data: Dashboard; t: Dict }) {
  const T = t.tape;
  const closes = data.benchmark?.closes ?? [];
  const last = closes.at(-1)?.[1] ?? null;
  const prev = closes.at(-2)?.[1] ?? null;
  const spyChg = last != null && prev ? last / prev - 1 : null;
  const acct = data.accounts.find((a) => a.key === "pt1") ?? data.accounts[0];
  const d = acct?.dollar ?? null;
  const fire = data.squeeze?.items.filter((x) => x.status === "fire").length ?? 0;
  const fuel = data.squeeze?.items.filter((x) => x.status === "fuel").length ?? 0;
  return (
    <aside className="tape" aria-label={T.aria}>
      <div className="container tape__inner">
        {last != null && (
          <span className="tape__item">
            <span className="tape__k">{T.spy}</span>
            <span className="num">{usd(last)}</span>
            <span className={`num ${tone(spyChg)}`}>{arrow(spyChg)}{pct(spyChg, 2)}</span>
          </span>
        )}
        {d && (
          <span className="tape__item">
            <span className="tape__k">{T.pt1}</span>
            <span className="num">{usd(d.equity)}</span>
            <span className={`num ${tone(d.return)}`}>{arrow(d.return)}{pct(d.return)}</span>
          </span>
        )}
        {d && (
          <span className="tape__item">
            <span className="tape__k">{T.vsSpy}</span>
            <span className={`num ${tone(d.return != null && d.spy_return != null ? d.return - d.spy_return : null)}`}>
              {pp(d.return, d.spy_return)}
            </span>
          </span>
        )}
        {acct && (
          <span className="tape__item">
            <span className="tape__k">{T.held}</span>
            <span className="num">{acct.positions.length}/{data.max_positions}</span>
          </span>
        )}
        {data.squeeze && (
          <span className="tape__item">
            <span className="tape__k" style={{ color: "var(--warn)" }}>{T.squeeze}</span>
            <span className="num">{T.squeezeVal(fire, fuel)}</span>
          </span>
        )}
      </div>
    </aside>
  );
}
