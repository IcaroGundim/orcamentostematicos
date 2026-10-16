import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from 'orcamentos-tematicos';
import { AlertCircleIcon, CheckCircle2Icon, FolderCogIcon, InfoIcon } from 'lucide-react';

export const Padrao = () => (
  <Alert style={{ width: '100%', maxWidth: '26rem' }}>
    <CheckCircle2Icon />
    <AlertTitle>Verifique seu e-mail</AlertTitle>
    <AlertDescription>
      Se houver uma conta com esses dados, enviamos um e-mail com instruções para redefinir a senha. O
      link é válido por 1 hora.
    </AlertDescription>
  </Alert>
);

export const Destrutivo = () => (
  <Alert variant="destructive" style={{ width: '100%', maxWidth: '26rem' }}>
    <AlertCircleIcon />
    <AlertTitle>Login não realizado</AlertTitle>
    <AlertDescription>Usuário ou senha inválidos. Confira os dados e tente novamente.</AlertDescription>
  </Alert>
);

export const ComentarioDaSeplan = () => (
  <Alert className="border-primary/25 bg-primary/5 text-primary" style={{ width: '100%', maxWidth: '26rem' }}>
    <InfoIcon />
    <AlertTitle>Comentário da SEPLAN</AlertTitle>
    <AlertDescription>
      Informe os municípios atendidos na entrega 2 e detalhe o público beneficiado antes de reenviar.
    </AlertDescription>
  </Alert>
);

export const SomenteDescricao = () => (
  <Alert className="border-primary/25 bg-primary/5" style={{ width: '100%', maxWidth: '26rem' }}>
    <FolderCogIcon />
    <AlertDescription className="text-xs">
      Os campos mostram a classificação gravada para <strong>OCAD</strong>. Edite os campos e use{' '}
      <strong>&quot;Salvar alterações&quot;</strong> — não é necessário remover a classificação para
      corrigi-la.
    </AlertDescription>
  </Alert>
);

export const ComAcao = () => (
  <Alert style={{ width: '100%', maxWidth: '26rem' }}>
    <InfoIcon />
    <AlertTitle>Nova versão do QDD disponível</AlertTitle>
    <AlertDescription>Coleta do SICAF de 29/09/2026 pronta para conferência.</AlertDescription>
    <AlertAction>
      <Button size="xs" variant="outline">
        Conferir
      </Button>
    </AlertAction>
  </Alert>
);
