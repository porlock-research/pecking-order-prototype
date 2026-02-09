import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pecking Order Lobby",
  description: "Join the game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
