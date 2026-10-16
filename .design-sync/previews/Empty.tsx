import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'orcamentos-tematicos';
import { Building2Icon, FileSpreadsheetIcon, SearchIcon, UserPlusIcon, UsersIcon } from 'lucide-react';

export const SemResultados = () => (
  <div className="w-[34rem] border border-black/70 bg-white">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhum dado para exibir</EmptyTitle>
        <EmptyDescription>Não há registros correspondentes aos filtros aplicados.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
);

export const ComBorda = () => (
  <div className="flex w-[34rem] bg-white" style={{ height: '16rem' }}>
    <Empty className="m-3 min-h-0 flex-1 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>Selecione uma secretaria</EmptyTitle>
        <EmptyDescription>
          Use o seletor acima para gerar a visão fiscal e, se necessário, detalhar uma unidade.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  </div>
);

export const ComAcao = () => (
  <div className="w-[34rem] bg-white">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhum usuário encontrado</EmptyTitle>
        <EmptyDescription>Ajuste os filtros ou cadastre um novo usuário.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm">
          <UserPlusIcon data-icon="inline-start" />
          Cadastrar usuário
        </Button>
      </EmptyContent>
    </Empty>
  </div>
);

export const IconeSimples = () => (
  <div className="w-[34rem] bg-white">
    <Empty className="border-none p-0">
      <EmptyHeader>
        <EmptyMedia>
          <FileSpreadsheetIcon />
        </EmptyMedia>
      </EmptyHeader>
      <EmptyTitle>Nenhum QDD vigente</EmptyTitle>
      <EmptyDescription>Importe o primeiro arquivo ao lado para iniciar a base.</EmptyDescription>
    </Empty>
  </div>
);
