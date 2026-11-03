import { redirect } from "next/navigation";

/**
 * 첫 화면 → 퀀트 대시보드 '오늘' 로 바로 (2026-11-02). 전에는 '프로젝트' 카드 하나뿐인 거의 빈 페이지였다.
 * 개인 소개 등 다른 내용이 생기면 그때 다시 페이지로 (content/profile.ts 는 그대로 둔다).
 */
export default function HomePage() {
  redirect("/quant");
}
