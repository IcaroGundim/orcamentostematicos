// Configuração do adaptador que empacota o Next para Cloudflare Workers.
//
// Sem `incrementalCache`: o template padrão usa um bucket R2, que serve para cache de
// ISR. Este app não tem página revalidada — as telas são estáticas ou renderizadas no
// cliente, e TODAS as rotas de API são dinâmicas (`ƒ` no build). Ligar R2 aqui só
// criaria um recurso pago para guardar cache que nunca é escrito.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
