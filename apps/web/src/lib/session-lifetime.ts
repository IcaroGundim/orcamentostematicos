/**
 * Vida útil das sessões.
 *
 * Antes disto, uma sessão valia para sempre: `Session` não tinha expiração e só
 * era apagada na redefinição de senha ou na exclusão do usuário. Um token Bearer
 * vazado — de um navegador compartilhado, de um log, de um backup — seguia
 * autenticando indefinidamente num sistema com dados orçamentários do Estado.
 *
 * A produção tinha 553 sessões para 8 usuários, todas válidas.
 *
 * A expiração usa `Session.createdAt`, que já existe: é vida ABSOLUTA, não
 * inatividade — não há renovação, então prorrogar a cada requisição exigiria uma
 * escrita em todo acesso. Trinta dias mantém o login prático para quem usa o
 * sistema em ciclos mensais de validação e ainda assim fecha a janela do token
 * eterno. Mudar aqui muda o comportamento inteiro; é o único lugar.
 */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Uma sessão criada em `createdAt` ainda vale em `now`? */
export function isSessionExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= SESSION_MAX_AGE_MS;
}

/** Limite para consultas: sessões com `createdAt` anterior a isto já expiraram. */
export function sessionExpiryCutoff(now: Date): Date {
  return new Date(now.getTime() - SESSION_MAX_AGE_MS);
}
