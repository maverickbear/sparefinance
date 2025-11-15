# Spare Finance Logos

Esta pasta contém os logos da Spare Finance em diferentes variantes.

## Estrutura de Arquivos

Os logos devem ser nomeados conforme a seguinte estrutura e adicionados nesta pasta:

### Ícones (para nav fechado e lugares pequenos)
- `icon-purple.svg` ou `icon-purple.png` - Ícone "S" roxo em fundo branco (rounded square)
- `icon-white.svg` ou `icon-white.png` - Ícone "s" branco em fundo roxo (rounded square)

### Wordmark (apenas texto)
- `wordmark-purple.svg` ou `wordmark-purple.png` - Logo "SPARE FINANCE" em roxo/azul em fundo claro/preto
- `wordmark-white.svg` ou `wordmark-white.png` - Logo "SPARE FINANCE" em branco em fundo escuro

### Full Logo (ícone + texto) - Opcional
- `full-purple.svg` ou `full-purple.png` - Logo completo com ícone roxo em fundo claro
- `full-white.svg` ou `full-white.png` - Logo completo com ícone branco em fundo escuro

**Nota**: Se os arquivos `full-*` não existirem, o componente automaticamente usa `wordmark-*` como fallback.

## Formatos Suportados

Os logos podem ser em formato SVG (recomendado) ou PNG. O componente Next.js Image suporta ambos.

## Uso

Use o componente `Logo` de `@/components/common/logo`:

```tsx
import { Logo } from "@/components/common/logo";

// Ícone pequeno (nav fechado) - padrão: 40x40
<Logo variant="icon" color="purple" height={40} />

// Logo completo adaptativo - padrão: 180x40
<Logo variant="full" color="auto" height={40} />

// Wordmark para headers - padrão: 150x40
<Logo variant="wordmark" color="white" height={40} />

// Com texto ao lado (apenas para variant="icon")
<Logo variant="icon" color="purple" showText />
```

## Variantes

- **icon**: Apenas o ícone "S" - use para nav fechado ou espaços pequenos
- **wordmark**: Apenas o texto "SPARE FINANCE" - use para headers maiores
- **full**: Ícone + texto completo - use como logo principal (fallback para wordmark se não disponível)

## Cores

- **purple**: Logo roxo/azul para fundos claros
- **white**: Logo branco para fundos escuros
- **auto**: Escolhe automaticamente baseado no tema (usa purple por padrão)

## Onde os Logos são Usados

Todos os logos têm altura fixa de **40px**:

- **Landing Header**: Wordmark 150x40 (white quando não scrolled, purple quando scrolled)
- **Sidebar Nav**: Icon 40x40 quando colapsado, Wordmark 150x40 quando expandido
- **Mobile Header**: Wordmark 150x40
- **Login Page**: Wordmark 150x40 (desktop e mobile)
- **Landing Footer**: Wordmark 150x40

## Fallback

Se as imagens não carregarem, o componente mostra um fallback visual apropriado para a variante "icon".

