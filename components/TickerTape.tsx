import { pct, pp, tone, usd } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { DashboardCore } from "@/lib/types";
import { Flash } from "./Flash";
import { Icon } from "./Icon";
import { Prov } from "./LiveMark";

function arrow(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) || v === 0 ? "" : v > 0 ? "▲ " : "▼ ";
}

/**
 * 머리글 아래 한 줄 — SPY 종가 · PT-1 $5,000 계좌 · SPY 대비 · 보유 칸 · 숏스퀴즈 (전부 dashboard.json 값).
 * 장중(2026-11-09)에는 lib/live.ts 가 덮어쓴 값 — SPY · PT-1 평가액 · SPY 대비 · 숏스퀴즈가 15분마다 바뀌고 (바뀐 숫자는
 * 잠깐 깜빡), PT-1 평가액에는 '잠정'. 보유 칸은 매매가 밤에만 일어나서 그대로. 장중인지는 머리 상태 줄이 보여 준다.
 */
export function TickerTape({ data, t }: { data: DashboardCore; t: Dict }) {
  const T = t.tape;
  const closes = data.benchmark?.closes ?? [];
  const last = closes.at(-1)?.[1] ?? null;
  const prev = closes.at(-2)?.[1] ?? null;
  const spyChg = last != null && prev ? last / prev - 1 : null;
  const acct = data.accounts.find((a) => a.key === "pt1") ?? data.accounts[0];
  const d = acct?.dollar ?? null;
  const fire = data.squeeze?.items.filter((x) => x.status === "fire").length ?? 0;
  const fuel = data.squeeze?.items.filter((x) => x.status === "fuel").length ?? 0;
  const gap = d && d.return != null && d.spy_return != null ? d.return - d.spy_return : null;
  return (
    <aside className="tape" aria-label={T.aria}>
      <div className="container tape__inner">
        {last != null && (
          <span className="tape__item">
            <span className="tape__k">{T.spy}</span>
            <Flash v={last} className="num">{usd(last)}</Flash>
            <span className={`num ${tone(spyChg)}`}>{arrow(spyChg)}{pct(spyChg, 2)}</span>
          </span>
        )}
        {d && (
          <span className="tape__item">
            <span className="tape__k">{T.pt1}</span>
            <Flash v={d.equity} className="num">{usd(d.equity)}</Flash>
            <span className={`num ${tone(d.return)}`}>{arrow(d.return)}{pct(d.return)}</span>
            <Prov mark={d.live} t={t} />
          </span>
        )}
        {d && (
          <span className="tape__item">
            <span className="tape__k">{T.vsSpy}</span>
            <Flash v={gap} className={`num ${tone(gap)}`}>{pp(d.return, d.spy_return)}</Flash>
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
            <Flash v={fire} className="num tape__fire"><Icon name="flame" size={13} />{T.squeezeVal(fire, fuel)}</Flash>
          </span>
        )}
      </div>
    </aside>
  );
}
