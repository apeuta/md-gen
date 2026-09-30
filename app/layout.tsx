import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { ConfigProvider } from "../context/ConfigContext";

// Muat font Open Sans dan ekspos sebagai CSS variable untuk dipakai Tailwind.
const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

// Metadata dasar aplikasi.
export const metadata: Metadata = {
  title: "Mandays Generator",
  description: "Aplikasi estimasi mandays project untuk Solution Architect",
};

// Root layout: membungkus seluruh halaman.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={openSans.variable}>
      <body className="min-h-screen bg-cream text-ink font-sans antialiased">
        {/* ConfigProvider (client component) membungkus seluruh aplikasi agar Config
            & Session tersedia via context. Aman dirender dari layout server karena
            provider sendiri sudah "use client" dan inisialisasi awalnya identik
            antara server & client (lihat catatan hydration di ConfigContext.tsx). */}
        <ConfigProvider>{children}</ConfigProvider>
      </body>
    </html>
  );
}
