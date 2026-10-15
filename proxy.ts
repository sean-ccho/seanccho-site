import { NextResponse, type NextRequest } from "next/server";

/**
 * /quant 비밀번호 (선택). 환경변수 SITE_PASSWORD 가 있으면 브라우저 기본 로그인 창으로 묻는다 — 아이디는 아무거나.
 * 없으면 그냥 통과. (데이터 파일 자체는 공개 리포에 있으니 '가볍게 가리기' 용도)
 */
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    try {
      const decoded = atob(encoded);
      if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {
      // 잘못된 헤더 — 아래에서 다시 묻는다
    }
  }
  return new NextResponse("비밀번호가 필요합니다", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="quant", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/quant", "/quant/:path*"],
};
