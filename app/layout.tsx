import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Skin Analysis — Find Your Routine",
  description:
    "Upload a selfie, answer four quick questions, and get a skincare routine matched ingredient-by-ingredient to your skin.",
  robots: { index: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
