import type { Metadata } from "next";
import { Geist, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RicePattyJulls — Red Team Operator",
  description:
    "Offensive security field manual and animated attack-path explorer. Authorized red team operations across external surface, web/API, identity, and internal domain.",
  keywords: [
    "red team",
    "offensive security",
    "penetration testing",
    "Active Directory",
    "Entra ID",
    "Azure",
    "web exploitation",
  ],
  authors: [{ name: "RicePattyJulls" }],
  openGraph: {
    title: "RicePattyJulls — Red Team Operator",
    description:
      "Offensive security field manual and animated attack-path explorer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
