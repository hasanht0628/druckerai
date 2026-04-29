import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "DruckerAI — AI Chief of Staff",
  description: "Protect your time. Focus on your highest contribution.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${interTight.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
