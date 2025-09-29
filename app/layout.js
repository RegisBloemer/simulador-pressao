// app/layout.js
import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Simulador de Pressão e Solucionador UFSC',
  description: 'Next.js + MUI + Chart.js + Nerdamer + Math.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
