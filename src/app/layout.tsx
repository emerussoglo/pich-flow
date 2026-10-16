import type { Metadata } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: "PichFlow — Infrastructure de Paiement Moderne pour l'Afrique",
  description: "Infrastructure de paiement moderne pour l'Afrique et les entreprises technologiques. Encaisser, automatiser et piloter tous les flux de paiement.",
  icons: {
    icon: '/img/log.png',
  },
  openGraph: {
    title: "PichFlow — Infrastructure de Paiement Moderne pour l'Afrique",
    description: "Infrastructure de paiement moderne pour l'Afrique et les entreprises technologiques. Encaisser, automatiser et piloter tous les flux de paiement.",
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

