import type { Metadata } from "next";
import { Noto_Sans_KR } from 'next/font/google';
import "./globals.css";
import NavBar from "@/components/NavBar";

const notoSansKR = Noto_Sans_KR({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "경력 관리",
  description: "자기소개서 작성 및 채용공고 통합 검색",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${notoSansKR.className} bg-gray-50 min-h-screen antialiased text-gray-800`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
