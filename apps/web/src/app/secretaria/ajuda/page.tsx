'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SecretariaHelpContent } from '@/components/domain/secretaria-help-content';
import { getStoredSession } from '@/lib/api';

export default function SecretariaAjudaPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'SECRETARIA_REPRESENTANTE' && session.user.role !== 'SECRETARIA_REVISOR') {
      router.push('/seplan');
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-primary/30 bg-primary text-primary-foreground shadow-sm">
        <div className="flex h-16 w-full items-center gap-3 px-4 lg:px-6 2xl:px-8">
          <img src="/logo.svg" alt="Logo" className="h-8 w-auto" />
          <span className="text-primary-foreground/50 font-semibold select-none" style={{ fontSize: '22px' }}>
            |
          </span>
          <span className="font-semibold uppercase tracking-widest" style={{ fontSize: '22px' }}>
            Orçamentos Temáticos
          </span>
        </div>
      </header>
      <SecretariaHelpContent />
    </main>
  );
}
