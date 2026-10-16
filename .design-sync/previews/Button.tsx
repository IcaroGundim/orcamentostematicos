import { Button } from 'orcamentos-tematicos';
import { CheckIcon, DownloadIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';

export const Variantes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Confirmar importação</Button>
    <Button variant="outline">Verificar prévia</Button>
    <Button variant="secondary">Cancelar</Button>
    <Button variant="ghost">Ver detalhes</Button>
    <Button variant="destructive">Limpar filtros</Button>
    <Button variant="link">Abrir ajuda</Button>
  </div>
);

export const Tamanhos = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="xs">Extra pequeno</Button>
    <Button size="sm">Pequeno</Button>
    <Button>Padrão</Button>
    <Button size="lg">Grande</Button>
  </div>
);

export const ComIcone = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="outline" size="sm">
      <RefreshCwIcon data-icon="inline-start" />
      Puxar QDD do SICAF agora
    </Button>
    <Button>
      <DownloadIcon data-icon="inline-start" />
      Exportar planilha
    </Button>
    <Button variant="outline" size="icon" aria-label="Aprovar">
      <CheckIcon />
    </Button>
    <Button variant="destructive" size="icon-sm" aria-label="Remover">
      <Trash2Icon />
    </Button>
  </div>
);

export const Desabilitado = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button disabled>Enviar validação</Button>
    <Button variant="outline" disabled>
      <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
      Atualizando...
    </Button>
  </div>
);
