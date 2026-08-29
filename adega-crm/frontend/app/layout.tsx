import type { Metadata, Viewport } from 'next';
import './globals.css';
import './login-desktop.css';
import './login-background-version.css';

export const metadata: Metadata = {
  title: 'Adega CRM',
  description: 'Gestão, PDV e vitrine premium para adegas',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07090b',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
