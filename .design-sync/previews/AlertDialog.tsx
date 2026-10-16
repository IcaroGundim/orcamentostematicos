import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from 'orcamentos-tematicos';
import { Trash2Icon } from 'lucide-react';

// Célula exibida no cartão (cardMode single): o diálogo aberto de exclusão de usuário.
export const Aberto = () => (
  <AlertDialog defaultOpen>
    <AlertDialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
        <AlertDialogDescription>
          Esta ação remove Representante SEMULHER (representante.semulher@exemplo.gov.br) e suas sessões. Não pode ser desfeita.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction>Excluir</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export const ConfirmacaoNaoDestrutiva = () => (
  <AlertDialog defaultOpen>
    <AlertDialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
      <AlertDialogHeader>
        <AlertDialogTitle>Salvar atalho neste dispositivo?</AlertDialogTitle>
        <AlertDialogDescription>
          A senha ficará guardada apenas neste navegador para entrar com um clique. Qualquer pessoa com
          acesso ao computador poderá usar o atalho. Você pode remover depois em &quot;Esquecer atalhos
          neste dispositivo&quot;.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Não salvar</AlertDialogCancel>
        <Button type="button">Sim, salvar atalho</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export const Fechado = () => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="outline" size="sm">
        <Trash2Icon data-icon="inline-start" />
        Excluir usuário
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction>Excluir</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
