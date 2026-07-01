import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "경력 관리",
  description: "자기소개서 작성 및 채용공고 통합 검색",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen antialiased text-gray-800">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
