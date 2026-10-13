import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Email Assistant",
  description: "AI-powered email assistant with Gemini, review loops, and Gmail workflow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-[#0d0d0e] text-zinc-100 antialiased flex flex-col selection:bg-zinc-700 selection:text-white">
        {children}
      </body>
    </html>
  );
}
