import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion — Dépenses & Bénéfice net",
  description:
    "Pilotez vos dépenses, votre paie et votre bénéfice net (commerçants, Belgique).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
