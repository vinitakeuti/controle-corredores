import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pabula | Assinaturas",
  description: "Controle simples de assinaturas para equipes de corrida e atletas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
