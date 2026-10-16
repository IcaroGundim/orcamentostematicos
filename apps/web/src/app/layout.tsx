import './globals.css';
import type { Metadata } from 'next';
import Script from "next/script";
import { Geist } from "next/font/google";
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from "@/lib/utils";
import { LaboratorioDeCores } from '@/components/dev/laboratorio-de-cores';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Orçamentos Temáticos do Acre',
  description: 'Sistema de gestão e validação dos orçamentos temáticos do Estado do Acre.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        {/* Ferramenta de desenvolvimento. O `layout` é componente de servidor e
            `NEXT_PUBLIC_LAB_CORES` é inlinado no build, então sem a variável
            este ramo é uma constante falsa e o painel nunca é montado. */}
        {process.env.NEXT_PUBLIC_LAB_CORES === '1' && <LaboratorioDeCores />}
      </body>
    </html>
  );
}
