"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/quant", label: "오늘" },
  { href: "/quant/candidates", label: "스크리너 후보" },
  { href: "/quant/charts", label: "차트" },
];

/** 퀀트 대시보드 메뉴 — 지금 페이지에 aria-current. */
export function QuantNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="대시보드 메뉴" className="q-nav site-nav">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
