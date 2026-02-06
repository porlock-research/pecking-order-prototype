import type { Metadata } from "next";

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
