import { redirect } from "next/navigation";

// 매매일지는 2026-10-16 내계좌와 합쳤다 (한 줄 = 거래 하나, 매도 완료 줄 + 매수이유별 성적). 옛 주소는 내계좌로.
export default function JournalPage() {
  redirect("/quant/account");
}
