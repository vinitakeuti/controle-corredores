import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pace Lab | Assinaturas",
  description: "Controle simples de assinaturas para equipes de corrida e atletas.",
  appleWebApp: {
    capable: true,
    title: "Pace Lab",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
