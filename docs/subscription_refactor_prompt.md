Centralizar tudo em getUserSubscription(userId)

Usada por:

middleware/server components (Next)

API de limites

/api/billing/subscription

Guard server-side nas rotas protegidas

Se plano não permite → redirect pra billing / paywall.

SubscriptionContext só pra UX

Recebe os dados do server (SSR/hidratação).

Atualiza:

quando o usuário volta da página do Stripe,

ou a cada X minutos (tipo 5).

Não precisa ouvir pathname pra tudo.

Hook useSubscription

Só re-exporta o contexto. Nada de fetch próprio.

Limites on-demand via API

Antes de criar transação / conta → API checa.

Front lida com os erros de “limite estourado”.