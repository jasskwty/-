import { NextResponse, type NextRequest } from "next/server";

// حماية بكلمة سر: إذا انحط APP_PASSWORD في الإعدادات، المتصفح يطلب اسم مستخدم وكلمة سر
// قبل فتح أي صفحة أو استخدام أي أداة. اسم المستخدم: APP_USER (افتراضياً: admin).
// بدون APP_PASSWORD التطبيق يشتغل مفتوح (مناسب للتشغيل على جهازك فقط).

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const user = process.env.APP_USER || "admin";

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (same(u, user) && same(rest.join(":"), password)) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("مطلوب تسجيل دخول", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="madrasati", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  // كل شي ما عدا ملفات Next الثابتة والأيقونة
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
