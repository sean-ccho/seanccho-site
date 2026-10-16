# personal-site

개인 웹사이트 + 퀀트 대시보드 (Next.js 16). 오른쪽 위 **EN / 한국어** 버튼으로 언어를 바꾼다 (쿠키에 1년 저장).

- `/` — 홈 (프로젝트 목록). 이름(SC)·프로젝트는 `content/profile.ts` 한 파일만 고치면 된다 (한국어·영어 둘 다).
- `/quant` — 오늘: PT-1 보유 종목·매도선, $5,000 계좌 vs 같은 날 SPY, 청산 성적, 다른 계좌, 후보 상위 5
- `/quant/candidates` — 스크리너 매수 후보 (필터 + 상세 + 차트)
- `/quant/charts` — 구글 시트 '차트분석' 탭처럼 종목별 차트를 아래로 쭉
- `/quant/stock/<티커>` — 종목 상세: 스크리너 판단, 재무(매출·이익 성장, 마진, ROE, 현금흐름…), 내부자 거래 90일, 패턴, 차트
- `/quant/account` — **내계좌**: 구글 시트 '내계좌' 탭과 양방향 연결 (비밀번호 필요)

## 데이터는 어디서 오나

이 리포에는 데이터가 없다. [Project_1](https://github.com/sean-ccho/Project_1) 의 매일 CI 가
`python -m web_export.dashboard` 로 `dashboard.json` 을 만들어 **`dashboard-data` 브랜치**에 덮어쓰고,
차트 캡처는 원래대로 `screenshots-sp500` / `screenshots-nasdaq` 브랜치에 올린다.
이 사이트는 그 GitHub raw 주소만 읽는다. CI 가 끝나면 `/api/revalidate` 를 불러 캐시를 바로 비우고,
그게 실패해도 30분마다 새로 받는다. 그래서 두 리포의 배포는 서로 엮이지 않는다.

```
Project_1 (매일 CI) ──► dashboard-data 브랜치 / screenshots-* 브랜치 ──► 이 사이트가 읽기만 함
                    └─► POST /api/revalidate (REVALIDATE_SECRET) ──► 캐시 비움
```

**내계좌만 예외** — 사이트가 구글 시트 '내계좌' 탭을 직접 읽고 쓴다 (서비스 계정, `lib/sheets.ts`).
웹에서 추가·수정·삭제하면 시트에 바로 쓰고, 시트에서 고친 값은 페이지를 새로고침하면 보인다.
웹은 입력 칸(티커·회사명·거래소·섹터·매수가·수량·매수일·메모)만 쓰고, 현재가·RSI 같은 분석 칸은
Project_1 이 매일 밤 채운다. 수정·삭제 직전에 그 줄이 아직 같은 종목인지 다시 확인해서, 그 사이 시트가 바뀌었으면 거절한다.

## 로컬에서 보기

```bash
npm install

# Project_1 폴더에서 개발용 데이터 만들기 (차트 목록은 원격 스크린샷 브랜치에서 읽는다)
cd ../Project_1/Project_1
git fetch origin screenshots-sp500 screenshots-nasdaq
CI=1 PYTHONPATH=.:src .venv/bin/python -m web_export.dashboard \
  --out ../../personal-site/dev-data/dashboard.json --charts-from-git
cd -

npm run dev        # http://localhost:3000
```

`.env.local` 의 `DASHBOARD_FILE=./dev-data/dashboard.json` 이 있으면 파일에서, 없으면 GitHub 에서 읽는다.
(`CI=1` 은 Project_1 의 `data/cache` 에 일봉 캐시를 쓰지 않게 하려는 것. 내부자 거래는 이미 받아 둔 캐시만 읽는다)

## 배포 (Vercel, 무료 Hobby)

1. GitHub 에 이 폴더를 새 리포로 올린다 (비공개 추천).
2. vercel.com → GitHub 로 로그인 → **Add New → Project** → 이 리포 Import → Deploy.
   설정은 기본값 그대로 (Framework: Next.js). 주소 `<프로젝트이름>.vercel.app` 가 생긴다. 이후 main 에 push 하면 자동 배포.
3. **Settings → Environment Variables** 에 아래 환경변수를 넣고 다시 배포한다.

### 손으로 갱신·배포하기 (GitHub Actions)

이 리포 **Actions → Deploy site → Run workflow** 에서 고른다.

| mode | 하는 일 | 필요한 Secret |
|---|---|---|
| `refresh-data` | 사이트 캐시만 비워 최신 dashboard.json 을 바로 보여 준다 (몇 초) | `REVALIDATE_SECRET` |
| `redeploy` | Vercel 에 다시 빌드·배포를 시킨다 (1~2분) | `VERCEL_DEPLOY_HOOK` (Vercel → Settings → Git → Deploy Hooks) |

## 환경변수

| 이름 | 설명 |
|---|---|
| `REVALIDATE_SECRET` | `/api/revalidate` 키. Project_1 GitHub Secret·이 리포 Secret 과 같은 값 |
| `SITE_PASSWORD` | **내계좌** 비밀번호 (브라우저 기본 로그인 창, 아이디는 아무거나). 없으면 내계좌는 열리지 않는다 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 구글 서비스 계정 JSON 전체 (Project_1 CI 와 같은 계정). 내계좌 시트 읽기·쓰기 |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | (선택) 시트 ID. 비우면 Project_1 config 의 ID |
| `DASHBOARD_URL` | (선택) 데이터 주소. 비우면 `sean-ccho/Project_1` 의 `dashboard-data` 브랜치 |
| `DASHBOARD_FILE` | 로컬 파일에서 읽기 (개발용) |
| `SHEETS_API_BASE` | 로컬 시험에서 가짜 Sheets 서버로 바꿀 때만 |

참고: `dashboard.json` 과 차트 이미지는 공개 리포(Project_1)에 있으므로 주소를 알면 누구나 볼 수 있다.
비밀번호는 내계좌(실제 보유 종목)만 가린다 — 내계좌 데이터는 구글 시트에만 있고 공개 리포에는 없다.

## 구조

```
app/              페이지 (layout, 홈, quant/*, quant/account 의 서버 액션, api/revalidate)
components/       화면 부품 (보유 종목 패널, 평가액 차트, 후보·차트 보기, 내계좌 표, 언어 버튼 …)
lib/              데이터 타입·불러오기·숫자 표시, i18n(문구), sheets(구글 시트), account(내계좌 줄)
content/          홈 화면 내용
proxy.ts          /quant/account 비밀번호 (Next.js 16 에서 middleware → proxy 로 이름이 바뀜)
.github/workflows/deploy.yml   손으로 갱신·배포
```
