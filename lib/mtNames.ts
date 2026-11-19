// 뉴스 기계번역 — 보통 낱말이기도 한 회사 이름 지키기 (2026-11-18, 사용자 점검 요청).
// 오늘 탭에 "Target earnings squash estimates" 가 "목표 수익이 예상보다 낮아졌습니다" 로 나왔다 (회사 이름 · 동사 둘 다 틀림).
// 실측 (구글 무료 번역, 11-18): 한글 이름을 넣으면 '베스트바이' → '최고급바이', 'Name (TICKER)' 도 가끔 '목표(TGT)' 로 바뀌었지만
// 티커 토큰만 넣으면 11/11 그대로 남았다. 그래서 번역 전에 이름 → 티커, 번역 뒤에 티커 → '한글(티커)'.
// 이름 하나만 있는 회사(Target · Gap · Block …)는 바로 뒤에 회사 문맥(실적 · 주가 · CEO · 's …)이 있을 때만 바꾼다 —
// 'Fed Hits Inflation Target' 처럼 낱말로 쓰인 것은 그대로. 서버(lib/translate) · 브라우저(lib/mtBrowser) 공용 — @/ 경로 없이.

type NameRule = {
  tk: string; // 번역기에 넣는 토큰 = 티커 (번역 뒤 '한글(티커)' 로)
  ko: string;
  strong?: string[]; // 그대로 회사 이름인 말 (문맥 없이 바꾼다)
  ctx?: string[]; // 보통 낱말이기도 한 이름 (뒤에 회사 문맥이 있을 때만)
};

export const NAME_RULES: NameRule[] = [
  { tk: "TGT", ko: "타깃", strong: ["Target Corp", "Target Corporation"], ctx: ["Target"] },
  { tk: "BBY", ko: "베스트바이", strong: ["Best Buy Co"], ctx: ["Best Buy"] },
  { tk: "DG", ko: "달러제너럴", strong: ["Dollar General"] },
  { tk: "DLTR", ko: "달러트리", strong: ["Dollar Tree"] },
  { tk: "GAP", ko: "갭", strong: ["Gap Inc"], ctx: ["Gap"] },
  { tk: "XYZ", ko: "블록", strong: ["Block Inc"], ctx: ["Block"] },
  { tk: "SNAP", ko: "스냅", strong: ["Snap Inc"], ctx: ["Snap"] },
  { tk: "SNOW", ko: "스노우플레이크", strong: ["Snowflake"] },
  { tk: "CAT", ko: "캐터필러", strong: ["Caterpillar"] },
  { tk: "CARR", ko: "캐리어", strong: ["Carrier Global"], ctx: ["Carrier"] },
  { tk: "LUV", ko: "사우스웨스트항공", strong: ["Southwest Airlines"], ctx: ["Southwest"] },
  { tk: "WDAY", ko: "워크데이", strong: ["Workday Inc"], ctx: ["Workday"] },
  { tk: "ARM", ko: "Arm", strong: ["Arm Holdings"], ctx: ["Arm"] },
  { tk: "AMAT", ko: "어플라이드머티어리얼즈", strong: ["Applied Materials"] },
  { tk: "CROX", ko: "크록스", strong: ["Crocs"] },
  { tk: "MNST", ko: "몬스터베버리지", strong: ["Monster Beverage"], ctx: ["Monster"] },
  { tk: "PGR", ko: "프로그레시브", strong: ["Progressive Corp", "Progressive Insurance"], ctx: ["Progressive"] },
  { tk: "TRV", ko: "트래블러스", ctx: ["Travelers"] },
  { tk: "CCL", ko: "카니발", ctx: ["Carnival"] },
  { tk: "NCLH", ko: "노르웨이지안크루즈", strong: ["Norwegian Cruise Line", "Norwegian Cruise"] },
  { tk: "BKNG", ko: "부킹홀딩스", strong: ["Booking Holdings"] },
  { tk: "ALLY", ko: "앨라이파이낸셜", strong: ["Ally Financial"], ctx: ["Ally"] },
  { tk: "RF", ko: "리전스파이낸셜", strong: ["Regions Financial"] },
  { tk: "CFG", ko: "시티즌스파이낸셜", strong: ["Citizens Financial"] },
  { tk: "CHTR", ko: "차터커뮤니케이션스", strong: ["Charter Communications"], ctx: ["Charter"] },
  { tk: "FOXA", ko: "폭스", strong: ["Fox Corp", "Fox Corporation"] },
  { tk: "WAT", ko: "워터스", strong: ["Waters Corp", "Waters Corporation"] },
  { tk: "DGX", ko: "퀘스트다이애그노스틱스", strong: ["Quest Diagnostics"] },
  { tk: "CAH", ko: "카디널헬스", strong: ["Cardinal Health"] },
  { tk: "MOS", ko: "모자이크", strong: ["Mosaic Co"], ctx: ["Mosaic"] },
  { tk: "DE", ko: "디어", strong: ["John Deere", "Deere & Co", "Deere & Company", "Deere"] },
  { tk: "OXY", ko: "옥시덴털", strong: ["Occidental Petroleum", "Occidental"] },
  { tk: "MPC", ko: "마라톤페트롤리엄", strong: ["Marathon Petroleum"] },
  { tk: "LCID", ko: "루시드", strong: ["Lucid Group", "Lucid Motors"], ctx: ["Lucid"] },
  { tk: "AFRM", ko: "어펌", ctx: ["Affirm"] },
  { tk: "CEG", ko: "컨스텔레이션에너지", strong: ["Constellation Energy"] },
  { tk: "STZ", ko: "컨스텔레이션브랜즈", strong: ["Constellation Brands"] },
  { tk: "VRTX", ko: "버텍스", strong: ["Vertex Pharmaceuticals"], ctx: ["Vertex"] },
  { tk: "IBKR", ko: "인터랙티브브로커스", strong: ["Interactive Brokers"] },
  { tk: "SHEL", ko: "셸", strong: ["Shell plc", "Shell PLC"], ctx: ["Shell"] },
  { tk: "CHWY", ko: "츄이", strong: ["Chewy"] },
  { tk: "ZM", ko: "줌", strong: ["Zoom Video", "Zoom Communications"] },
  { tk: "ESTC", ko: "엘라스틱", ctx: ["Elastic"] },
  { tk: "CFLT", ko: "컨플루언트", strong: ["Confluent"] },
  { tk: "SMCI", ko: "슈퍼마이크로", strong: ["Super Micro Computer", "Super Micro", "Supermicro"] },
  { tk: "MRVL", ko: "마벨", strong: ["Marvell Technology", "Marvell"] },
  { tk: "ISRG", ko: "인튜이티브서지컬", strong: ["Intuitive Surgical"] },
  { tk: "BSX", ko: "보스턴사이언티픽", strong: ["Boston Scientific"] },
  { tk: "THC", ko: "테닛헬스케어", strong: ["Tenet Healthcare"] },
  { tk: "PSA", ko: "퍼블릭스토리지", strong: ["Public Storage"] },
  { tk: "WM", ko: "웨이스트매니지먼트", strong: ["Waste Management"] },
  { tk: "RSG", ko: "리퍼블릭서비스", strong: ["Republic Services"] },
  { tk: "GIS", ko: "제너럴밀스", strong: ["General Mills"] },
  { tk: "COF", ko: "캐피털원", strong: ["Capital One"] },
  { tk: "STT", ko: "스테이트스트리트", strong: ["State Street"] },
  { tk: "NTRS", ko: "노던트러스트", strong: ["Northern Trust"] },
  { tk: "FITB", ko: "피프스서드", strong: ["Fifth Third"] },
  { tk: "DLR", ko: "디지털리얼티", strong: ["Digital Realty"] },
  { tk: "CCI", ko: "크라운캐슬", strong: ["Crown Castle"] },
  { tk: "LVS", ko: "라스베이거스샌즈", strong: ["Las Vegas Sands"] },
  { tk: "LYV", ko: "라이브네이션", strong: ["Live Nation"] },
  { tk: "WBD", ko: "워너브러더스디스커버리", strong: ["Warner Bros. Discovery", "Warner Bros Discovery"] },
  { tk: "SG", ko: "스위트그린", strong: ["Sweetgreen"] },
  { tk: "BROS", ko: "더치브로스", strong: ["Dutch Bros"] },
];

// 이름 바로 뒤가 이것이면 회사로 본다 (대소문자 무시) — 소유격 · (티커) · 회사 꼬리 · 실적/주가 낱말 · 실적 동사.
// 오르다 · 내리다 · 말하다 같은 흔한 동사는 넣지 않는다 ('Wealth Gap Rises' · 'Progressive Caucus Says' 를 회사로 보지 않게)
const COMPANY_CTX = new RegExp(
  String.raw`^(?:['’]s\b|\s*\(|,?\s+(?:Inc|Corp|Co|Corporation|Holdings|plc)\b|\s+(?:shares?|stock|earnings|revenue|sales|` +
    String.raw`profits?|results|quarter|q[1-4]|guidance|outlook|forecasts?|ceo|cfo|stores?|layoffs?|lays\s+off|dividend|buyback|` +
    String.raw`ipo|investors?|price\s+target|beats?|miss(?:es|ed)?|exceed(?:s|ed)?|tops?|topped|reports?|reported|posts?|posted|` +
    String.raw`slash(?:es|ed)?|squash(?:es|ed)?|crush(?:es|ed)?|smash(?:es|ed)?|trounce[sd]?|raise[sd]?|lowers?|lowered|cuts?|` +
    String.raw`warns?|warned|agrees|names|hires|to\s+(?:buy|acquire|cut|sell|close|open|lay|spin|split))\b)`,
  "i",
);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Compiled = { rule: NameRule; re: RegExp; strong: boolean };
const COMPILED: Compiled[] = NAME_RULES.flatMap((rule) => [
  ...(rule.strong ?? []).map((n) => ({ rule, n, strong: true })),
  ...(rule.ctx ?? []).map((n) => ({ rule, n, strong: false })),
])
  .sort((a, b) => b.n.length - a.n.length) // 긴 이름 먼저 ('Southwest Airlines' → 'Southwest')
  .map(({ rule, n, strong }) => ({
    rule,
    strong,
    // 대소문자 그대로 (회사 이름은 대문자로 시작) · 뒤에 같은 티커가 '(TGT)' · '(NYSE: TGT)' 로 붙어 있으면 같이 먹는다
    re: new RegExp(String.raw`\b${esc(n)}\b(?:\s*\((?:[A-Za-z ]+:\s*)?${esc(rule.tk)}\))?`, "g"),
  }));

/** 번역 전 — 회사 이름 → 티커 토큰. 'shares of Target' 처럼 앞에 붙는 꼴도 회사로 본다. */
export function protectNames(title: string): string {
  let s = title;
  for (const c of COMPILED) {
    s = s.replace(c.re, (m: string, at: number, whole: string) => {
      if (c.strong) return c.rule.tk;
      const after = whole.slice(at + m.length);
      const before = whole.slice(Math.max(0, at - 12), at);
      return COMPANY_CTX.test(after) || /(?:shares|stock) of\s*$/i.test(before) ? c.rule.tk : m;
    });
  }
  return s;
}

const BY_TK = new Map(NAME_RULES.map((r) => [r.tk, r]));

/**
 * 번역 뒤 — protectNames 가 넣은 티커 토큰을 '한글(티커)' 로. mt = 번역기에 넣은 글 (거기 있는 토큰만 바꾼다 —
 * 원래 제목에 티커가 있던 경우에도 같은 회사라 맞다).
 */
export function restoreNames(ko: string, mt: string): string {
  let out = ko;
  for (const [tk, r] of BY_TK) {
    const re = new RegExp(String.raw`(?<![A-Za-z(])${esc(tk)}(?![A-Za-z)])`, "g");
    if (!re.test(mt)) continue;
    out = out.replace(new RegExp(String.raw`(?<![A-Za-z(])${esc(tk)}(?![A-Za-z)])`, "g"), `${r.ko}(${tk})`);
  }
  return out;
}
