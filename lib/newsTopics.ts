// 오늘 탭 '오늘의 핵심 뉴스' 주제 칩 (2026-11-10) — #거시경제 · #빅테크 · #지정학 · #수급.
// 구글 뉴스 제목 낱말로만 나눈다 (AI 분류 아님): 영어 기사는 원문 제목, 한국 기사는 한글 제목.
// 한 기사가 여러 주제에 들어가기도 하고 어디에도 안 들어가기도 한다 — 칩은 '이 낱말이 나온 기사' 거르기일 뿐.
// @/ 경로를 안 써서 Node 로 바로 시험된다.

export type NewsTopic = "macro" | "tech" | "geo" | "flow";
export const NEWS_TOPICS: readonly NewsTopic[] = ["macro", "tech", "geo", "flow"];

const EN: Record<NewsTopic, RegExp> = {
  macro:
    /\b(fed|fomc|powell|central banks?|bank of (canada|england|japan)|ecb|interest rates?|rate (cuts?|hikes?)|inflation|deflation|cpi|ppi|pce|consumer prices?|jobs? (report|data|numbers)|payrolls?|jobless|unemployment|labou?r market|layoffs?|gdp|recession|econom(y|ic|ies|ists?)|treasur(y|ies)|yields?|bonds?|tariffs?|trade (war|deal|deficit|surplus|talks)|deficits?|national debt|debt ceiling|shutdown|budget|consumer (spending|confidence|sentiment)|retail sales|housing|home (sales|prices)|mortgages?|gas prices|oil prices?|crude|opec|dollar|currenc(y|ies)|exports?|imports?|imf|world bank)\b/i,
  tech:
    /\b(apple|iphone|microsoft|nvidia|alphabet|google|amazon|aws|meta|facebook|instagram|tesla|openai|chatgpt|anthropic|gemini|xai|spacex|ai|artificial intelligence|chips?|chipmakers?|semiconductors?|broadcom|intel|amd|tsmc|qualcomm|micron|netflix|oracle|salesforce|palantir|ibm|cisco|dell|coreweave|data cent(er|re)s?|software|big tech|tech (stocks?|giants?|companies|firms|stack)|zuckerberg|nadella|altman|bezos|samsung|sk hynix|softbank|robotaxis?|autonomy|autonomous|streaming)\b/i,
  geo:
    /\b(wars?|warfare|military|troops|soldiers|army|navy|missiles?|drones?|nuclear|sanctions?|ceasefire|truce|peace (talks|deal|plan)|invasion|invad(e|ed|es|ing)|air ?strikes?|strikes? on|attacks?|russia|russian|putin|kremlin|moscow|ukraine|ukrainian|kyiv|zelensk(y|yy|iy)|china|chinese|beijing|xi jinping|taiwan|iran|iranian|tehran|israel|israeli|gaza|hamas|hezbollah|lebanon|syria|yemen|houthis?|north korea|pyongyang|kim jong|nato|pentagon|geopolitic(s|al)|diplomats?|diplomatic|embass(y|ies)|summit|venezuela|cuba|terror(ism|ist|ists)?|coup|rebels?|militants?|border)\b/i,
  flow:
    /\b(ipos?|initial public offering|listing|debut|share sale|stock offering|secondary offering|buybacks?|repurchases?|inflows?|outflows?|fund flows?|etfs?|hedge funds?|short sellers?|short interest|short squeeze|margin (debt|calls?)|retail (investors|traders)|institutional (investors|buyers)|selloff|sell-off|bitcoin|crypto|cryptocurrenc(y|ies)|options (traders|market)|insider (buying|selling|trades?)|index inclusion|rebalanc\w*|valuations?|market (cap|value))\b/i,
};

// 한글 — '핵심' · '탄핵'의 '핵', '경기도'의 '경기', '정부 기관'의 '기관'처럼 다른 낱말에 섞이는 글자는 빼거나 붙여 쓴다
const KO: Record<NewsTopic, RegExp> = {
  macro:
    /금리|연준|물가|인플레|고용|실업|경기\s?(침체|둔화|회복|부양|전망)|경제|환율|관세|국채|성장률|한은|한국은행|무역|수출|유가|예산|재정|부동산|집값|주택|소비자|GDP|CPI|셧다운|채권|달러/,
  tech: /삼성전자|하이닉스|반도체|인공지능|AI|엔비디아|애플|테슬라|구글|마이크로소프트|아마존|오픈AI|빅테크|네이버|카카오|데이터센터|소프트뱅크|자율주행|소프트웨어|로봇/,
  geo: /전쟁|군사|군대|미사일|드론|(?<![탄결])핵(?!심)|제재|휴전|침공|공습|러시아|푸틴|우크라이나|젤렌스키|중국|시진핑|대만|이란|이스라엘|가자|하마스|북한|김정은|나토|NATO|국방|외교|정상회담|안보|국경|테러|쿠데타|반군|탈북/,
  flow: /수급|외국인\s?(투자|매수|매도|순)|순매수|순매도|공매도|자사주|상장|IPO|유상증자|공모|매도세|매수세|ETF|펀드|자금\s?(유입|유출)|개미|비트코인|가상자산|시가총액|빚투/,
};

const HANGUL = /[가-힣]/;

/** 기사 주제 — 한글 제목이면 한글 낱말, 아니면 영어 원문 제목 (기계번역 글자는 안 본다: 번역 낱말이 그때그때 달라서). */
export function newsTopics(item: { title: string }): NewsTopic[] {
  const rules = HANGUL.test(item.title) ? KO : EN;
  return NEWS_TOPICS.filter((k) => rules[k].test(item.title));
}
