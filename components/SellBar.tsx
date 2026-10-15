import { pct, usd } from "@/lib/format";
import type { Position } from "@/lib/types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** ▼ 매도선과 ▲ 익절선 사이 어디쯤에 현재가(점)·매수가(눈금)가 있는지. */
export function SellBar({ pos }: { pos: Position }) {
  const { up, down, up_tag, down_tag } = pos.exit;
  const price = pos.price ?? pos.entry_price;
  if (down == null) return <span className="muted">—</span>;
  // 재평가 보류 중이면 ▲ 선이 없다 — 오른쪽 끝은 현재가·고점보다 조금 위로
  const top = up ?? Math.max(price, pos.highest_price ?? price, pos.entry_price) * 1.03;
  const span = top - down || 1;
  const at = (v: number) => `${clamp(((v - down) / span) * 100, 0, 100)}%`;
  return (
    <div className="sellbar">
      <div className="sellbar__vals">
        <span className="down">▼ {usd(down)}</span>
        {up != null ? <span className="up">▲ {usd(up)}</span> : <span className="muted">▲ 보류 중</span>}
      </div>
      <div className="sellbar__track" aria-hidden="true">
        <span className="sellbar__entry" style={{ left: at(pos.entry_price) }} />
        <span className="sellbar__now" style={{ left: at(price) }} />
      </div>
      <div className="sellbar__tags">
        <span className={price <= down ? "down" : undefined}>
          {down_tag} {price <= down ? "· 이미 아래" : pct(down / price - 1)}
        </span>
        {up != null && (
          <span className={price >= up ? "up" : undefined}>
            {up_tag} {price >= up ? "· 이미 위" : pct(up / price - 1)}
          </span>
        )}
      </div>
      <span className="sr-only">
        현재가 {usd(price)}, 매도선 {usd(down)}
        {up != null ? `, 익절선 ${usd(up)}` : ""}
      </span>
    </div>
  );
}

/** '26일째부터 ▼ $21.79 (장기보유)' */
export function nextChangeText(pos: Position): string {
  const nxt = pos.exit.next;
  if (!nxt) return "—";
  return `${nxt.day}일째부터 ${nxt.side === "up" ? "▲" : "▼"} ${usd(nxt.price)} (${nxt.tag})`;
}
