/**
 * Spare Design System - Usage Examples
 * 
 * Este arquivo contém exemplos práticos de como usar os tokens
 * do Spare Design System em componentes React/TypeScript.
 */

import React from 'react';
import { getToken, tokens, colors } from '../tokens';

// ============================================================================
// Exemplo 1: Botão Primário
// ============================================================================

export function PrimaryButtonExample({ children }: { children: React.ReactNode }) {
  const bgColor = getToken('component.button.primary.bg');
  const textColor = getToken('component.button.primary.text');
  const hoverBg = getToken('component.button.primary.bg-hover');
  
  const [isHovered, setIsHovered] = React.useState(false);
  
  return (
    <button
      style={{
        backgroundColor: isHovered ? hoverBg : bgColor,
        color: textColor,
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        fontWeight: 500,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Exemplo 2: Card com Tokens
// ============================================================================

export function CardExample({ children }: { children: React.ReactNode }) {
  const cardBg = getToken('component.card.bg');
  const cardBorder = getToken('component.card.border');
  const cardFg = getToken('component.card.fg');
  
  return (
    <div
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '12px',
        padding: '24px',
        color: cardFg,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Exemplo 3: Input com Estados
// ============================================================================

export function InputExample() {
  const inputBg = getToken('component.input.bg');
  const inputBorder = getToken('component.input.border');
  const inputBorderFocus = getToken('component.input.border-focus');
  const inputText = getToken('component.input.text');
  const inputPlaceholder = getToken('component.input.placeholder');
  
  const [isFocused, setIsFocused] = React.useState(false);
  
  return (
    <input
      type="text"
      placeholder="Digite algo..."
      style={{
        backgroundColor: inputBg,
        borderColor: isFocused ? inputBorderFocus : inputBorder,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '8px',
        padding: '12px 16px',
        color: inputText,
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
}

// ============================================================================
// Exemplo 4: Badge com Cores Semânticas
// ============================================================================

type BadgeVariant = 'success' | 'error' | 'warning' | 'info';

export function BadgeExample({ 
  variant, 
  children 
}: { 
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  const bgColor = getToken(`component.badge.${variant}.bg`);
  const textColor = getToken(`component.badge.${variant}.text`);
  
  return (
    <span
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Exemplo 5: Alert Component
// ============================================================================

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export function AlertExample({ 
  variant, 
  children 
}: { 
  variant: AlertVariant;
  children: React.ReactNode;
}) {
  const bgColor = getToken(`component.alert.${variant}.bg`);
  const borderColor = getToken(`component.alert.${variant}.border`);
  const textColor = getToken(`component.alert.${variant}.text`);
  
  return (
    <div
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '8px',
        padding: '16px',
        color: textColor,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Exemplo 6: Gráfico com Cores de Chart
// ============================================================================

export function ChartExample({ data }: { data: Array<{ name: string; value: number }> }) {
  const incomeColor = getToken('component.chart.income');
  const expensesColor = getToken('component.chart.expenses');
  
  return (
    <div style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '16px', color: getToken('color.text.primary') }}>
        Income vs Expenses
      </h3>
      <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
        {data.map((item, index) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: index % 2 === 0 ? incomeColor : expensesColor,
              }}
            />
            <span style={{ flex: 1, color: getToken('color.text.primary') }}>
              {item.name}
            </span>
            <span style={{ color: getToken('color.text.secondary') }}>
              ${item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Exemplo 7: Categoria Badge
// ============================================================================

export function CategoryBadgeExample({ category }: { category: string }) {
  // Mapear categoria para cor do token
  const categoryColorMap: Record<string, string> = {
    'Rent': getToken('color.category.blue') ?? '#3b82f6',
    'Groceries': getToken('color.category.emerald') ?? '#10b981',
    'Restaurants': getToken('color.category.amber') ?? '#f59e0b',
    'Medical': getToken('color.category.red') ?? '#ef4444',
    'Education': getToken('color.category.purple') ?? '#8b5cf6',
    'Travel': getToken('color.category.cyan') ?? '#06b6d4',
    'Vehicle': getToken('color.category.orange') ?? '#f97316',
    'Clothing': getToken('color.category.pink') ?? '#ec4899',
    'Home & Lifestyle': getToken('color.category.teal') ?? '#14b8a6',
    'Electronics': getToken('color.category.indigo') ?? '#6366f1',
  };
  
  const color = categoryColorMap[category] || (getToken('color.category.gray') ?? '#6b7280');
  const textColor = getToken('color.text.inverse') ?? '#ffffff';
  
  return (
    <span
      style={{
        backgroundColor: color,
        color: textColor,
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        display: 'inline-block',
      }}
    >
      {category}
    </span>
  );
}

// ============================================================================
// Exemplo 8: Hook Customizado para Tokens
// ============================================================================

export function useDesignTokens() {
  return React.useMemo(() => ({
    // Cores semânticas
    primary: getToken('color.semantic.primary'),
    success: getToken('color.semantic.success'),
    error: getToken('color.semantic.error'),
    warning: getToken('color.semantic.warning'),
    info: getToken('color.semantic.info'),
    
    // Cores de texto
    textPrimary: getToken('color.text.primary'),
    textSecondary: getToken('color.text.secondary'),
    textTertiary: getToken('color.text.tertiary'),
    
    // Cores de background
    bgPrimary: getToken('color.bg.primary'),
    bgSecondary: getToken('color.bg.secondary'),
    bgTertiary: getToken('color.bg.tertiary'),
    
    // Cores de borda
    borderDefault: getToken('color.border.default'),
    borderFocus: getToken('color.border.focus'),
    
    // Componentes
    button: {
      primary: {
        bg: getToken('component.button.primary.bg'),
        text: getToken('component.button.primary.text'),
        hover: getToken('component.button.primary.bg-hover'),
      },
      secondary: {
        bg: getToken('component.button.secondary.bg'),
        text: getToken('component.button.secondary.text'),
      },
    },
    card: {
      bg: getToken('component.card.bg'),
      border: getToken('component.card.border'),
      fg: getToken('component.card.fg'),
    },
  }), []);
}

// Exemplo de uso do hook
export function ComponentWithHook() {
  const tokens = useDesignTokens();
  
  return (
    <div
      style={{
        backgroundColor: tokens.bgPrimary,
        color: tokens.textPrimary,
        padding: '24px',
        borderRadius: '12px',
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      <h2 style={{ color: tokens.textPrimary, marginBottom: '16px' }}>
        Título
      </h2>
      <p style={{ color: tokens.textSecondary }}>
        Texto secundário usando tokens
      </p>
      <button
        style={{
          backgroundColor: tokens.button.primary.bg,
          color: tokens.button.primary.text,
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          marginTop: '16px',
        }}
      >
        Botão Primário
      </button>
    </div>
  );
}

// ============================================================================
// Exemplo 9: Suporte a Dark Mode
// ============================================================================

export function ThemedComponent({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  // Simular detecção de tema (em produção, use next-themes ou similar)
  const [isDark, setIsDark] = React.useState(false);
  
  const bgColor = isDark
    ? getToken('component.card.bg-dark')
    : getToken('component.card.bg');
  
  const textColor = isDark
    ? getToken('component.card.fg-dark')
    : getToken('component.card.fg');
  
  const borderColor = isDark
    ? getToken('component.card.border-dark')
    : getToken('component.card.border');
  
  return (
    <div
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderColor: borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => setIsDark(!isDark)}>
          Toggle {isDark ? 'Light' : 'Dark'} Mode
        </button>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Exemplo 10: Health Score Gradient
// ============================================================================

export function HealthScoreExample({ score }: { score: number }) {
  const startColor = getToken('component.chart.health-score-start');
  const midColor = getToken('component.chart.health-score-mid');
  const endColor = getToken('component.chart.health-score-end');
  
  // Calcular cor baseada no score (0-100)
  const getColorForScore = (score: number) => {
    if (score < 33) return startColor; // Red
    if (score < 66) return midColor;    // Amber
    return endColor;                     // Green
  };
  
  const gradientColor = getColorForScore(score);
  
  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          width: '200px',
          height: '12px',
          backgroundColor: '#e5e7eb',
          borderRadius: '6px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: `linear-gradient(to right, ${startColor}, ${midColor}, ${endColor})`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <p style={{ marginTop: '8px', color: getToken('color.text.secondary') }}>
        Health Score: {score}/100
      </p>
    </div>
  );
}

// ============================================================================
// Exemplo 11: Navegação com Tokens
// ============================================================================

export function NavigationExample() {
  const navBg = getToken('component.navigation.bg');
  const navBorder = getToken('component.navigation.border');
  const navLink = getToken('component.navigation.link');
  const navLinkActive = getToken('component.navigation.link-active');
  
  const [activeLink, setActiveLink] = React.useState('home');
  
  const links = ['home', 'dashboard', 'transactions', 'reports'];
  
  return (
    <nav
      style={{
        backgroundColor: navBg,
        borderBottom: `1px solid ${navBorder}`,
        padding: '16px 24px',
        display: 'flex',
        gap: '24px',
      }}
    >
      {links.map((link) => (
        <a
          key={link}
          href={`#${link}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveLink(link);
          }}
          style={{
            color: activeLink === link ? navLinkActive : navLink,
            textDecoration: 'none',
            fontWeight: activeLink === link ? 600 : 400,
            textTransform: 'capitalize',
            transition: 'color 0.2s',
          }}
        >
          {link}
        </a>
      ))}
    </nav>
  );
}

// ============================================================================
// Exemplo 12: Acessar Tokens Diretamente do Objeto
// ============================================================================

export function DirectAccessExample() {
  // Acessar tokens diretamente do objeto (sem helper function)
  const primaryColor = tokens.semantic.color.semantic.primary.value;
  const buttonBg = tokens.component.button.primary.bg.value;
  
  return (
    <div style={{ padding: '24px' }}>
      <p style={{ color: primaryColor }}>
        Texto usando cor primária: {primaryColor}
      </p>
      <button
        style={{
          backgroundColor: buttonBg,
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Botão com Background: {buttonBg}
      </button>
    </div>
  );
}

