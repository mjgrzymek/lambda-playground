import type { Metadata } from "next";
import { Inter, Inconsolata } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const inconsolata = Inconsolata({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inconsolata",
});

const latinModernMath = localFont({
  src: "./latinmodern-math.otf",
  display: "swap",
  variable: "--font-latin-modern-math",
});

export const metadata: Metadata = {
  title: "Lambda playground",
  description: "Play with the lambda calculus in JS or Python",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inconsolata.variable} ${latinModernMath.variable} dark`}
    >
      <body className={inter.className}>{children}</body>
    </html>
  );
}
