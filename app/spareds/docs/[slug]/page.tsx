'use client';

import React from 'react';
import Link from 'next/link';

const docPages = {
  usage: {
    title: 'Guia de Uso',
    content: (
      <div className="prose dark:prose-invert max-w-none">
        <h2>Como Usar os Tokens</h2>
        <p>O Spare Design System fornece tokens através de múltiplos métodos.</p>
        
        <h3>Importação Direta</h3>
        <pre className="bg-foreground text-background p-4 rounded-lg">
          <code>{`import { getToken } from '@/spareds/tokens';

const color = getToken('component.button.primary.bg');`}</code>
        </pre>

        <h3>API REST</h3>
        <pre className="bg-foreground text-background p-4 rounded-lg">
          <code>{`fetch('/api/spareds/tokens?type=component')
  .then(res => res.json())
  .then(data => console.log(data));`}</code>
        </pre>

        <h3>Arquivos JSON</h3>
        <pre className="bg-foreground text-background p-4 rounded-lg">
          <code>{`fetch('/spareds/tokens/colors/component-tokens.json')
  .then(res => res.json())
  .then(data => console.log(data));`}</code>
        </pre>
      </div>
    ),
  },
  hierarchy: {
    title: 'Hierarquia de Tokens',
    content: (
      <div className="prose dark:prose-invert max-w-none">
        <h2>Os 4 Níveis</h2>
        <ol>
          <li>
            <strong>Default Values</strong> - Valores brutos (hex, pixels)
          </li>
          <li>
            <strong>Foundation Tokens</strong> - Tokens primitivos
          </li>
          <li>
            <strong>Semantic Tokens</strong> - Tokens semânticos
          </li>
          <li>
            <strong>Component Tokens</strong> - Tokens de componentes
          </li>
        </ol>
        <p>
          Cada nível referencia o anterior, criando uma hierarquia clara e
          manutenível.
        </p>
      </div>
    ),
  },
  colors: {
    title: 'Sistema de Cores',
    content: (
      <div className="prose dark:prose-invert max-w-none">
        <h2>Paleta de Cores</h2>
        <p>
          O sistema inclui cores primárias, semânticas, escala de cinza e cores
          para categorias.
        </p>
        <Link
          href="/spareds/colors/primary"
          className="text-[#4A4AF2] hover:underline"
        >
          Ver todas as cores →
        </Link>
      </div>
    ),
  },
};

export default function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = React.use(params);
  const page = docPages[resolvedParams.slug as keyof typeof docPages];

  if (!page) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-foreground">Página não encontrada</h1>
        <p className="text-muted-foreground">A documentação solicitada não existe.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">{page.title}</h1>
      </div>
      <div className="bg-card rounded-lg border border-border p-8">
        {page.content}
      </div>
    </div>
  );
}

