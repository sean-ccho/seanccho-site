"use client";

import { useState } from "react";

export type SortDir = "desc" | "asc";
export type SortState<K extends string> = { key: K; dir: SortDir } | null;
/** 정렬할 열 하나 — 값 꺼내는 함수 + 처음 눌렀을 때 방향 (숫자는 높은 순, 종목명은 A→Z). */
export type SortCol<T> = { get: (row: T) => number | string | null | undefined; first?: SortDir };

/** 값이 없는 줄은 방향과 상관없이 항상 맨 아래, 같은 값은 원래 순서 유지. */
export function sortRows<T>(rows: T[], get: SortCol<T>["get"], dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  const missing = (v: unknown) => v == null || (typeof v === "number" && Number.isNaN(v));
  return rows
    .map((row, i) => ({ row, v: get(row), i }))
    .sort((a, b) => {
      const am = missing(a.v);
      const bm = missing(b.v);
      if (am || bm) return am === bm ? a.i - b.i : am ? 1 : -1;
      const c = typeof a.v === "string" || typeof b.v === "string"
        ? String(a.v).localeCompare(String(b.v))
        : (a.v as number) - (b.v as number);
      return c * sign || a.i - b.i;
    })
    .map((x) => x.row);
}

/** 표 머리글 정렬 — 한 번 누르면 높은 순(종목명은 A→Z), 다시 누르면 반대, 세 번째는 원래 순서. */
export function useTableSort<T, K extends string>(cols: Record<K, SortCol<T>>) {
  const [sort, setSort] = useState<SortState<K>>(null);
  const toggle = (key: K) =>
    setSort((s) => {
      const first = cols[key].first ?? "desc";
      if (!s || s.key !== key) return { key, dir: first };
      if (s.dir === first) return { key, dir: first === "desc" ? "asc" : "desc" };
      return null;
    });
  const apply = (rows: T[]): T[] => (sort ? sortRows(rows, cols[sort.key].get, sort.dir) : rows);
  return { sort, toggle, apply };
}

/** 눌러서 정렬하는 열 이름 칸 — 지금 정렬 중이면 ▼(높은 순)/▲(낮은 순), 아니면 흐린 ↕. */
export function SortTh<K extends string>({ k, sort, onSort, children, className, title }: {
  k: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const dir = sort?.key === k ? sort.dir : null;
  return (
    <th scope="col" className={className} title={title}
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
      <button type="button" className="th-sort" data-active={dir ? "" : undefined} onClick={() => onSort(k)}>
        {children}
        <span className="th-sort__arrow" aria-hidden="true">{dir === "desc" ? "▼" : dir === "asc" ? "▲" : "↕"}</span>
      </button>
    </th>
  );
}
