# Spare Finance - Personal Finance Web App

A comprehensive personal finance web application built with Next.js 15, TypeScript, and Supabase (PostgreSQL). Track expenses, manage budgets, and monitor investments with granular category tracking.

## Features

- **Transaction Management**: Full CRUD operations with support for income, expenses, and transfers
- **Granular Categories**: Macro → Category → Subcategory hierarchy
- **Budget Tracking**: Monthly budgets with status indicators (OK/Warning/Over)
- **Investment Monitoring**: Track holdings, transactions, and portfolio performance
- **CSV Import/Export**: Import transactions from CSV files with column mapping
- **Dark Mode**: Full dark mode support using next-themes
- **Reports**: Monthly summary and top expenses analysis

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL)
- **Zod** for validation
- **React Hook Form** for forms
- **Recharts** for charts
- **lucide-react** for icons

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables (create `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Seed the database with sample data:

```bash
npm run db:seed
```

4. Start the development server:

```bash
npm run dev
```

Open [https://sparefinance.com/](https://sparefinance.com/) in your browser.

## Deploy

### Deploy Gratuito na Vercel

Para fazer deploy gratuito na Vercel:

1. **Prepare o repositório GitHub**
   - Crie um repositório no GitHub
   - Faça commit e push do código

2. **Configure na Vercel**
   - Acesse [vercel.com](https://vercel.com) e faça login com GitHub
   - Adicione um novo projeto e selecione o repositório
   - Configure as variáveis de ambiente:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Clique em Deploy

3. **Pronto!** Seu app estará online em `https://seu-projeto.vercel.app`

Para instruções detalhadas, veja [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:seed` - Seed database with sample data

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── transactions/      # Transactions page
│   ├── budgets/          # Budgets page
│   ├── categories/       # Categories page
│   ├── accounts/         # Accounts page
│   ├── investments/      # Investment pages
│   └── reports/          # Reports page
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── forms/           # Form components
│   ├── charts/          # Chart components
│   └── common/          # Common components
├── lib/                 # Utilities and helpers
│   ├── api/            # Server actions
│   ├── validations/    # Zod schemas
│   └── csv/            # CSV import/export
└── supabase/           # Supabase migrations
```

## Database Schema

The app uses Supabase (PostgreSQL) directly. Key tables:

- `Account` - Banking and investment accounts
- `Transaction` - Income, expense, and transfer transactions
- `Macro` / `Category` / `Subcategory` - Hierarchical categorization
- `Budget` - Monthly budgets by category
- `InvestmentAccount` - Investment accounts
- `Security` - Securities (stocks, ETFs, crypto, etc.)
- `InvestmentTransaction` - Buy/sell/dividend transactions
- `SecurityPrice` - Manual price history

## Features in Detail

### Transactions

- Create, edit, and delete transactions
- Support for income, expenses, and transfers
- Transfer transactions create linked entries in both accounts
- Filter by date range, category, account, and type
- Search functionality
- CSV import with column mapping
- CSV export

### Budgets

- Set monthly budgets by category
- Visual progress bars with status indicators
- Calculate actual spend vs budget
- Status colors: Green (≤90%), Yellow (90-100%), Red (>100%)

### Investments

- Track investment accounts (TFSA, RRSP, Crypto Wallet, etc.)
- Manage securities (stocks, ETFs, crypto, bonds, REITs)
- Record transactions (buy, sell, dividend, interest)
- Holdings calculation with weighted average cost
- Portfolio value tracking
- Manual price updates

### Reports

- Monthly summary table showing budget vs actual
- Top 10 expenses
- Category/subcategory breakdown

## Security

This application implements **Row Level Security (RLS)** in Supabase to ensure data isolation between users. All user-owned data is protected at the database level.

For detailed information about RLS implementation, see [RLS_SECURITY.md](./RLS_SECURITY.md).

### Encryption and Audit

The application supports **encryption of sensitive transaction data** (amounts, descriptions) with a controlled audit system for fiscal and legal compliance.

For detailed information about encryption and audit procedures, see [ENCRYPTION_AND_AUDIT.md](./ENCRYPTION_AND_AUDIT.md).

## License

MIT

# spare-finance
# spare-finance
