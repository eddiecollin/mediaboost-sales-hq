import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mediaboost Sales HQ",
  description: "Cold-calling management and sales performance dashboard for Mediaboost."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
