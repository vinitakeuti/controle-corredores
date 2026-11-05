import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonte de títulos servida pelo próprio app (CSP font-src 'self'). Licença em ./fonts/Anton-OFL.txt.
// Anton tem um peso só; a faixa 400–900 evita negrito sintético onde o CSS pede peso maior.
const anton = localFont({
  src: "./fonts/anton-latin.woff2",
  weight: "400 900",
  style: "normal",
  display: "swap",
  variable: "--font-anton",
  fallback: ["Impact", "Arial Narrow Bold", "sans-serif"],
});

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
    <html lang="pt-BR" className={anton.variable}>
      <body>{children}</body>
    </html>
  );
}
