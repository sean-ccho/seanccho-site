# personal-site

개인 웹사이트 + 퀀트 대시보드 (Next.js 16).

- `/` — 홈 (소개·프로젝트). 내용은 `content/profile.ts` 한 파일만 고치면 된다.
- `/quant` — 오늘: PT-1 보유 종목·매도선, $5,000 계좌 vs 같은 날 SPY, 청산 성적, 다른 계좌, 후보 상위 5
- `/quant/candidates` — 스크리너 매수 후보 (필터 + 상세 + 차트)
- `/quant/charts` — 구글 시트 '차트분석' 탭처럼 종목별 차트를 아래로 쭉

## 데이터는 어디서 오나

이 리포에는 데이터가 없다. [Project_1](https://github.com/sean-ccho/Project_1) 의 매일 CI 가
`python -m web_export.dashboard` 로 `dashboard.json` 을 만들어 **`dashboard-data` 브랜치**에 덮어쓰고,
차트 캡처는 원래대로 `screenshots-sp500` / `screenshots-nasdaq` 브랜치에 올린다.
이 사이트는 그 GitHub raw 주소만 읽는다 (30분마다 새로 받음). 그래서 두 리포의 배포는 서로 엮이지 않는다.

```
Project_1 (매일 CI) ──► dashboard-data 브랜치 / screenshots-* 브랜치 ──► 이 사이트가 읽기만 함
```

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
(`CI=1` 은 Project_1 의 `data/cache` 에 일봉 캐시를 쓰지 않게 하려는 것)

## 배포 (Vercel, 무료 Hobby)

1. GitHub 에 이 폴더를 새 리포로 올린다 (비공개 추천).
2. vercel.com → GitHub 로 로그인 → **Add New → Project** → 이 리포 Import → Deploy.
   설정은 기본값 그대로 (Framework: Next.js). 주소 `<프로젝트이름>.vercel.app` 가 생긴다.
3. (선택) **Settings → Environment Variables** 에 `SITE_PASSWORD` 를 넣으면 `/quant` 에 들어갈 때 비밀번호를 묻는다.
4. Project_1 쪽 CI 변경(dashboard.json 내보내기)이 올라가고 한 번 돌면 화면이 채워진다. 그 전에는 '데이터 없음' 안내가 보인다.

## 환경변수

| 이름 | 설명 |
|---|---|
| `DASHBOARD_URL` | 데이터 주소. 비우면 `sean-ccho/Project_1` 의 `dashboard-data` 브랜치 |
| `DASHBOARD_FILE` | 로컬 파일에서 읽기 (개발용) |
| `SITE_PASSWORD` | `/quant` 비밀번호 (브라우저 기본 로그인 창, 아이디는 아무거나) |

참고: `dashboard.json` 과 차트 이미지는 공개 리포(Project_1)에 있으므로 주소를 알면 누구나 볼 수 있다.
비밀번호는 사이트 화면만 가린다.

## 구조

```
app/              페이지 (layout, 홈, quant/*)
components/       화면 부품 (보유 종목 패널, 평가액 차트, 후보·차트 보기 …)
lib/              데이터 타입·불러오기·숫자 표시
content/          홈 화면 내용
proxy.ts          /quant 비밀번호 (Next.js 16 에서 middleware → proxy 로 이름이 바뀜)
```
