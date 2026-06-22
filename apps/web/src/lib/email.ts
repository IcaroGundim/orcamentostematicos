import 'server-only';

import { Resend } from 'resend';

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Envio de e-mail não configurado: defina RESEND_API_KEY em apps/web/.env.local.',
    );
  }
  return new Resend(apiKey);
}

function getFrom(): string {
  return process.env.RESEND_FROM || 'Orçamentos Temáticos <onboarding@resend.dev>';
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  link: string,
): Promise<void> {
  const resend = getResend();
  const saudacao = name ? `Olá, ${name}` : 'Olá';

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="color: #166534; margin-bottom: 8px;">Redefinição de senha</h2>
      <p>${saudacao},</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no sistema
      <strong>Orçamentos Temáticos</strong>. Clique no botão abaixo para criar uma nova senha:</p>
      <p style="margin: 24px 0;">
        <a href="${link}"
           style="background: #166534; color: #ffffff; text-decoration: none; padding: 12px 20px;
                  border-radius: 8px; display: inline-block; font-weight: 600;">
          Redefinir minha senha
        </a>
      </p>
      <p style="font-size: 14px; color: #6b7280;">
        Este link é válido por 1 hora e só pode ser usado uma vez.
        Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
      </p>
      <p style="font-size: 13px; color: #9ca3af; word-break: break-all;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br />${link}
      </p>
    </div>
  `;

  const text = `${saudacao},

Recebemos um pedido para redefinir a senha da sua conta no sistema Orçamentos Temáticos.
Acesse o link abaixo para criar uma nova senha (válido por 1 hora, uso único):

${link}

Se você não solicitou a redefinição, ignore este e-mail.`;

  const { error } = await resend.emails.send({
    from: getFrom(),
    to,
    subject: 'Redefinição de senha — Orçamentos Temáticos',
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao enviar o e-mail de redefinição.');
  }
}
