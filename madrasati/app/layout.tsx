import type { Metadata, Viewport } from "next";
import { Alexandria, Tajawal } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-alexandria",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مساعدي المدرسي",
  description: "مساعد دراسي ذكي لطلاب المدارس الكويتية من الصف السادس إلى الثاني عشر",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#070b19" },
  ],
};

// يطبق الثيم قبل ما تظهر الصفحة عشان ما يصير وميض
const themeScript = `try{var t=localStorage.getItem("madrasati:theme");t=t?JSON.parse(t):"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${alexandria.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
