'use client';

import React from 'react';
import { tokens, defaultValuesTokens } from '@/spareds/tokens';

const tokenPages = {
  'default-values': {
    title: 'Default Values',
    description: 'Nível 1: Valores brutos (hex, pixels, etc.)',
    data: defaultValuesTokens,
  },
  foundation: {
    title: 'Foundation Tokens',
    description: 'Nível 2: Tokens primitivos fundamentais',
    data: tokens.foundation,
  },
  semantic: {
    title: 'Semantic Tokens',
    description: 'Nível 3: Tokens com propósito semântico',
    data: tokens.semantic,
  },
  component: {
    title: 'Component Tokens',
    description: 'Nível 4: Tokens específicos de componentes',
    data: tokens.component,
  },
};

export default function TokenPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = React.use(params);
  const page = tokenPages[resolvedParams.slug as keyof typeof tokenPages];

  if (!page) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-foreground">Página não encontrada</h1>
        <p className="text-muted-foreground">O token solicitado não existe.</p>
      </div>
    );
  }


  const renderTokenValue = (value: any, depth = 0): React.ReactNode => {
    if (typeof value === 'string') {
      return (
        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
          {value}
        </span>
      );
    }

    if (value && typeof value === 'object') {
      if (value.value) {
        return (
          <div className="space-y-2">
            <div className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">
              {value.value}
            </div>
            {value.description && (
              <div className="text-sm text-muted-foreground">
                {value.description}
              </div>
            )}
          </div>
        );
      }

      if (value.properties) {
        // JSON schema structure
        return (
          <div className="ml-4 space-y-2">
            {Object.entries(value.properties).map(([key, val]: [string, any]) => (
              <div key={key} className="border-l-2 border-border pl-4">
                <div className="font-semibold text-sm mb-1">{key}</div>
                {renderTokenValue(val, depth + 1)}
              </div>
            ))}
          </div>
        );
      }

      // Regular object
      return (
        <div className="ml-4 space-y-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="border-l-2 border-gray-200 dark:border-gray-700 pl-4">
              <div className="font-semibold text-sm mb-1">{key}</div>
              {renderTokenValue(val, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-muted-foreground">null</span>;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">{page.title}</h1>
        <p className="text-muted-foreground">{page.description}</p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <pre className="overflow-x-auto">
          <code className="text-sm">
            {JSON.stringify(page.data, null, 2)}
          </code>
        </pre>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Estrutura</h2>
        <div className="bg-card rounded-lg border border-border p-6">
          {renderTokenValue(page.data)}
        </div>
      </div>
    </div>
  );
}

