/**
 * Static blog posts data (personal finance content).
 * Used by BlogService. Add new posts here or migrate to MD/CMS later.
 */

import type { BlogPost } from "@/src/domain/blog/blog.types";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "como-construir-um-orcamento-mensal-que-funciona",
    title: "Como Construir um Orçamento Mensal Que Realmente Funciona",
    description:
      "Um guia passo a passo para criar um orçamento mensal realista, acompanhar gastos e manter o controle sem se sentir sobrecarregado. Dicas práticas de finanças pessoais.",
    datePublished: "2025-02-01",
    dateModified: "2025-02-09",
    author: "Cody Fisher",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cody",
    image: {
      src: "/landing/hero.jpg",
      alt: "Pessoas planejando finanças em reunião",
      width: 800,
      height: 500,
    },
    tags: ["Orçamento", "Dicas"],
    keywords: ["budget", "monthly budget", "personal finance", "saving money", "expense tracking"],
    body: `Acompanhar seu dinheiro não precisa ser complicado. Um orçamento mensal simples ajuda você a ver para onde vai seu dinheiro e abrir espaço para o que importa.

Comece listando sua renda: salário, bicos e qualquer outra entrada regular. Use o valor líquido para trabalhar com números reais.

Em seguida, liste as despesas fixas: aluguel ou financiamento, contas, seguros, assinaturas e parcelas. São valores iguais (ou próximos) todo mês.

Depois, as despesas variáveis: mercado, combustível, restaurantes, lazer. Use os últimos meses para definir valores realistas.

Por fim, defina uma meta de economia ou redução de dívidas. Mesmo um valor pequeno por mês cria o hábito e faz diferença no longo prazo.

Revise seu orçamento pelo menos uma vez por mês e ajuste conforme a vida mudar. O objetivo não é perfeição—é consciência e controle para sair da ansiedade e ganhar clareza.`,
  },
  {
    slug: "por-que-rastrear-gastos-e-o-primeiro-passo-para-paz-financeira",
    title: "Por Que Rastrear Gastos É o Primeiro Passo para a Paz Financeira",
    description:
      "Entender para onde vai seu dinheiro reduz estresse e melhora suas decisões. Veja por que o controle de gastos funciona e como começar.",
    datePublished: "2025-02-05",
    author: "Guy Hawkins",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guy",
    image: {
      src: "/landing/dashboard.jpg",
      alt: "Dashboard de controle financeiro",
      width: 600,
      height: 400,
    },
    tags: ["Gastos", "Dicas"],
    keywords: ["expense tracking", "personal finance", "money management", "financial health", "spending"],
    body: `Você não melhora o que não mede. Quando você rastreia seus gastos, para de adivinhar e passa a saber.

Muita gente evita olhar o que gasta porque parece estressante. Mas o estresse vem de não saber—ficar na dúvida se dá ou não, ou para onde foi tudo. Rastrear troca essa incerteza por clareza.

Não é preciso anotar cada centavo para sempre. Algumas semanas de registro já mostram padrões: onde você mais gasta, onde vazam pequenos valores e onde já está indo bem.

Use categorias que façam sentido para sua vida: mercado, transporte, assinaturas, restaurantes etc. O objetivo é enxergar o quadro geral, não julgar cada café.

Com o quadro claro, você pode definir metas simples: gastar um pouco menos em uma categoria, poupar um valor fixo por mês ou reduzir dívidas. Pequenos passos consistentes geram mudança real.`,
  },
  {
    slug: "como-sair-das-dividas-sem-desespero",
    title: "Como Sair das Dívidas Sem Desespero",
    description:
      "Estratégias práticas para reduzir dívidas de forma sustentável: método bola de neve, priorização e mudança de hábitos sem sacrificar tudo.",
    datePublished: "2025-02-07",
    dateModified: "2025-02-09",
    author: "Floyd Miles",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Floyd",
    image: {
      src: "/landing/planning.jpg",
      alt: "Planejamento financeiro e metas",
      width: 600,
      height: 400,
    },
    tags: ["Dívidas", "Planejamento"],
    keywords: ["debt", "pay off debt", "personal finance", "financial freedom"],
    body: `Sair das dívidas é mais sobre consistência do que sobre milagres. O primeiro passo é ter uma visão clara: liste todas as dívidas, taxas de juros e parcelas mínimas.

Duas abordagens comuns: a "bola de neve" (quitar primeiro a menor dívida para ganhar motivação) e a "avalanche" (atacar primeiro a que tem maior juro). Ambas funcionam; escolha a que você vai conseguir manter.

Proteja uma reserva de emergência mínima antes de jogar todo o dinheiro extra na dívida. Assim você evita novos empréstimos quando algo inesperado acontecer.

Ajuste hábitos aos poucos: corte uma assinatura, reduza um hábito de consumo, mas não tente mudar tudo de uma vez. Pequenas vitórias sustentam o processo.

Celebre cada dívida quitada. Reconhecer o progresso mantém você no jogo até a última parcela.`,
  },
  {
    slug: "reserva-de-emergencia-por-onde-comecar",
    title: "Reserva de Emergência: Por Onde Começar",
    description:
      "Por que todo mundo precisa de uma reserva de emergência e como construir a sua, mesmo com orçamento apertado. Metas realistas e onde guardar o dinheiro.",
    datePublished: "2025-02-08",
    author: "Maria Silva",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    image: {
      src: "/landing/family.jpg",
      alt: "Família e planejamento financeiro",
      width: 600,
      height: 400,
    },
    tags: ["Reserva", "Poupança"],
    keywords: ["emergency fund", "savings", "personal finance", "financial security"],
    body: `A reserva de emergência é a base da segurança financeira. Ela cobre imprevistos—desemprego, saúde, reparos—sem precisar entrar no cheque especial ou em empréstimos.

Uma meta comum é ter de 3 a 6 meses de despesas essenciais guardados. Se isso parecer distante, comece com um objetivo menor: um mês, ou até as primeiras mil unidades da moeda. O importante é começar.

Onde guardar: em conta que renda um pouco e permita resgate rápido—poupança ou aplicações de liquidez diária. Evite investimentos de longo prazo para esse dinheiro.

Separe um valor fixo todo mês, mesmo que pequeno. Automatize o débito para uma conta separada assim que o salário cair. Com o tempo, a reserva cresce sem você depender só da “sobra”.

Revise o valor da reserva quando suas despesas ou renda mudarem. Esse hábito simples reduz ansiedade e abre espaço para outros objetivos, como investir ou realizar sonhos.`,
  },
];
