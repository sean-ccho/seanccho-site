import { unstable_cache } from "next/cache";

/**
 * 관리 탭 — Project_1 GitHub 작업 실행 기록 (2026-11-04). 서버에서만 부른다 (토큰이 브라우저로 가지 않게).
 * GITHUB_TOKEN(읽기 전용 · Project_1 하나)이 있으면 한 시간 5,000번, 없으면 IP 마다 60번이라 Vercel 처럼 IP 를 같이 쓰는
 * 서버에선 막힐 수 있다. 토큰이 틀렸거나 만료돼 401 이 오면 토큰 없이 한 번 더 묻는다 (공개 저장소).
 * 실행 기록은 5분 캐시 — 실패는 캐시하지 않는다 (throw).
 */

const REPO = "sean-ccho/Project_1";
const API = "https://api.github.com";
const REVALIDATE = 300;

function baseHeaders(): Record<string, string> {
  return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "seancho-site-admin" };
}

async function gh<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers = baseHeaders();
  let res = await fetch(API + path, { headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers, cache: "no-store" });
  if (res.status === 401 && token) res = await fetch(API + path, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}`);
  return (await res.json()) as T;
}

export type RunLite = {
  id: number;
  number: number;
  attempt: number;
  event: string;
  status: string; // queued · in_progress · completed
  conclusion: string | null; // success · failure · cancelled · timed_out · skipped …
  created: string;
  started: string;
  updated: string;
  url: string;
};

type RawRun = {
  id: number; run_number: number; run_attempt?: number; event: string; status: string; conclusion: string | null;
  created_at: string; run_started_at?: string; updated_at: string; html_url: string;
};

/** 작업 하나의 최근 실행 (새 것부터). */
export const getRuns = unstable_cache(
  async (file: string, n: number): Promise<{ runs: RunLite[]; fetchedAt: string }> => {
    const d = await gh<{ workflow_runs: RawRun[] }>(`/repos/${REPO}/actions/workflows/${file}/runs?per_page=${n}`);
    return {
      fetchedAt: new Date().toISOString(),
      runs: d.workflow_runs.map((r) => ({
        id: r.id, number: r.run_number, attempt: r.run_attempt ?? 1, event: r.event, status: r.status, conclusion: r.conclusion,
        created: r.created_at, started: r.run_started_at ?? r.created_at, updated: r.updated_at, url: r.html_url,
      })),
    };
  },
  ["gh-admin-runs"],
  { revalidate: REVALIDATE },
);

export type StepLite = { name: string; status: string; conclusion: string | null; started: string | null; completed: string | null };

type RawJobs = { jobs: { name: string; steps?: { name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null }[] }[] };

/** 실행 하나의 단계들 (작업이 job 여럿이면 순서대로 이어 붙인다). 끝난 실행은 바뀌지 않아서 하루 캐시. */
const stepsDone = unstable_cache(
  async (runId: number): Promise<StepLite[]> => stepsOf(await gh<RawJobs>(`/repos/${REPO}/actions/runs/${runId}/jobs`)),
  ["gh-admin-steps"],
  { revalidate: 86400 },
);
const stepsLive = unstable_cache(
  async (runId: number): Promise<StepLite[]> => stepsOf(await gh<RawJobs>(`/repos/${REPO}/actions/runs/${runId}/jobs`)),
  ["gh-admin-steps-live"],
  { revalidate: REVALIDATE },
);
function stepsOf(d: RawJobs): StepLite[] {
  return d.jobs.flatMap((j) =>
    (j.steps ?? []).map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion, started: s.started_at, completed: s.completed_at })),
  );
}
export function getSteps(run: RunLite): Promise<StepLite[]> {
  return run.status === "completed" ? stepsDone(run.id) : stepsLive(run.id);
}

/** 브랜치 마지막 커밋 시각. */
export const getBranchDate = unstable_cache(
  async (branch: string): Promise<string | null> => {
    const d = await gh<{ commit?: { commit?: { committer?: { date?: string } } } }>(`/repos/${REPO}/branches/${encodeURIComponent(branch)}`);
    return d.commit?.commit?.committer?.date ?? null;
  },
  ["gh-admin-branch"],
  { revalidate: REVALIDATE },
);

export type ApiAccess = {
  /** token = 토큰이 먹힘 · none = 토큰 없음 · bad = 토큰이 틀렸거나 만료 · error = GitHub 에 못 물어봄 */
  mode: "token" | "none" | "bad" | "error";
  limit: number | null;
  remaining: number | null;
  reset: string | null;
};

/** 토큰 상태 · 남은 횟수 — /rate_limit 은 횟수를 쓰지 않아서 볼 때마다 새로 묻는다. */
export async function getApiAccess(): Promise<ApiAccess> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const ask = async (auth: boolean) => {
    const res = await fetch(`${API}/rate_limit`, {
      headers: auth && token ? { ...baseHeaders(), Authorization: `Bearer ${token}` } : baseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return { status: res.status, core: null };
    const d = (await res.json()) as { resources: { core: { limit: number; remaining: number; reset: number } } };
    return { status: res.status, core: d.resources.core };
  };
  try {
    if (token) {
      const r = await ask(true);
      if (r.core) return { mode: "token", limit: r.core.limit, remaining: r.core.remaining, reset: new Date(r.core.reset * 1000).toISOString() };
      if (r.status !== 401) return { mode: "error", limit: null, remaining: null, reset: null };
      const anon = await ask(false);
      return anon.core
        ? { mode: "bad", limit: anon.core.limit, remaining: anon.core.remaining, reset: new Date(anon.core.reset * 1000).toISOString() }
        : { mode: "bad", limit: null, remaining: null, reset: null };
    }
    const anon = await ask(false);
    return anon.core
      ? { mode: "none", limit: anon.core.limit, remaining: anon.core.remaining, reset: new Date(anon.core.reset * 1000).toISOString() }
      : { mode: "error", limit: null, remaining: null, reset: null };
  } catch {
    return { mode: "error", limit: null, remaining: null, reset: null };
  }
}
