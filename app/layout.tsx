import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azur · Allocation de portefeuille",
  description: "Espaces clients, frontière efficiente et stratégies d’allocation avec frais de transaction.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
