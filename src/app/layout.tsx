import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nokhaba Payroll · 2026 Enterprise System",
  description: "Premium 2026 enterprise payroll & operations platform for Saudi logistics — centralized rules engine, bilingual payslips, real-time analytics.",
  keywords: ["payroll", "logistics", "Saudi Arabia", "salary engine", "rules control center", "2026"],
  authors: [{ name: "Nokhaba Tatweer for Trading" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased bg-background text-foreground`}
        style={{ ['--font-arabic' as string]: "var(--font-cairo), 'Cairo', sans-serif" }}
      >
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
