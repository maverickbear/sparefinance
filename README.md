# 💰 Spare Finance

> Complete personal finance management platform built with Next.js 16, React 19, TypeScript, and Supabase.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Architecture](#-architecture)
- [Security](#-security)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 📊 Financial Dashboard
- **Real-time Overview**: Track income, expenses, and net worth
- **Interactive Charts**: Beautiful visualizations with Recharts
- **Spare Score**: AI-powered insights
- **Month Selector**: Navigate through historical data
- **Customizable Widgets**: Modular dashboard components

### 💳 Account Management
- **Multiple Account Types**: Checking, savings, credit, investments
- **Bank Integration**: Connect via Plaid
- **Balance Tracking**: Automatic balance calculations
- **Multi-user Support**: Household member management

### 📝 Transaction Tracking
- **Smart Categorization**: AI-powered category suggestions
- **Bulk Operations**: Import/export via CSV
- **Advanced Filters**: Search by date, category, account
- **Encrypted Storage**: Secure transaction data
- **Recurring Transactions**: Automatic tracking

### 💰 Budget Management
- **Flexible Budgets**: Monthly, quarterly, annual
- **Category-based**: Track spending by category
- **Progress Indicators**: Visual budget execution
- **Alerts**: Notifications when approaching limits

### 🎯 Goals & Planning
- **Financial Goals**: Set and track savings goals
- **Progress Tracking**: Visual progress indicators
- **Priority Management**: High, medium, low priorities
- **Deadline Tracking**: ETA calculations

### 💳 Debt Management
- **Loan Tracking**: Mortgages, car loans, student loans
- **Payment Schedules**: Automatic calculations
- **Payoff Strategies**: Avalanche & snowball methods
- **Interest Tracking**: Monitor total interest paid

### 📈 Investment Portfolio
- **Position Tracking**: Real-time holdings
- **Performance Charts**: Track investment growth
- **Asset Allocation**: Diversification analysis

### 💼 Billing & Subscriptions
- **Stripe Integration**: Secure payment processing
- **Multiple Plans**: Free and premium tiers
- **Trial Periods**: Risk-free testing
- **Customer Portal**: Self-service management

### 🤖 AI Features
- **Smart Insights**: OpenAI-powered recommendations
- **Automated Categorization**: Learn from your patterns
- **Financial Chat**: Ask questions about your finances
- **Anomaly Detection**: Unusual spending alerts

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16.0 (App Router, Server Components)
- **UI Library**: React 19.0
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS 3.4
- **Components**: Radix UI (accessible, customizable)
- **Charts**: Recharts 2.10
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **ORM**: Supabase Client
- **Payments**: Stripe 19.2
- **Banking**: Plaid 39.1
- **Emails**: Resend 6.4
- **AI**: OpenAI 4.28

### DevOps
- **Deployment**: Vercel
- **Testing**: Jest 29.7
- **Linting**: ESLint + Prettier
- **CI/CD**: GitHub Actions (recommended)
- **Containerization**: Docker Compose

---

## 🚀 Getting Started

### Prerequisites

```bash
- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account (for billing)
- Plaid account (for bank connections)
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/naortartarotti/spare-finance.git
   cd spare-finance
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Required environment variables:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   
   # Plaid
   PLAID_CLIENT_ID=your_plaid_client_id
   PLAID_SECRET=your_plaid_secret
   PLAID_ENV=sandbox # or development/production
   
   # OpenAI (optional)
   OPENAI_API_KEY=your_openai_key
   ```

4. **Set up the database**
   ```bash
   # Run migrations
   npm run db:migrate
   
   # Seed the database (optional)
   npm run db:seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Docker Setup (Alternative)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📁 Project Structure

```
spare-finance/
├── app/                          # Next.js App Router
│   ├── (auth-required)/         # Routes requiring authentication
│   ├── (protected)/             # Main dashboard and features
│   ├── api/                     # API routes (80+)
│   ├── auth/                    # Login/Signup pages
│   └── page.tsx                 # Landing page
│
├── components/                   # React Components (150+)
│   ├── ui/                      # Base UI components
│   ├── dashboard/               # Dashboard widgets
│   ├── forms/                   # Reusable forms
│   ├── charts/                  # Chart components
│   └── common/                  # Shared components
│
├── lib/                         # Business Logic
│   ├── api/                     # API functions
│   ├── services/                # Service layer (NEW!)
│   │   ├── transaction-calculations.ts
│   │   ├── balance-calculator.ts
│   │   ├── cache-manager.ts
│   │   └── error-handler.ts
│   ├── types/                   # TypeScript types (NEW!)
│   ├── validations/             # Zod schemas
│   └── utils/                   # Utility functions
│
├── hooks/                       # Custom React Hooks
├── contexts/                    # React Contexts
├── supabase/                    # Database migrations
├── scripts/                     # Utility scripts
├── tests/                       # Test files
└── docs/                        # Documentation
```

---

## 🏗️ Architecture

### Design Principles

1. **Separation of Concerns**: Clear separation between UI, business logic, and data
2. **Type Safety**: TypeScript everywhere with strict mode
3. **Security First**: RLS policies, encryption, rate limiting
4. **Performance**: Caching, code splitting, optimized queries
5. **Maintainability**: Clean code, consistent patterns, documentation

### Key Components

#### Service Layer
```typescript
// Centralized business logic
import { calculateTotalIncome } from '@/lib/services/transaction-calculations'
import { calculateAccountBalances } from '@/lib/services/balance-calculator'
import { withCache } from '@/lib/services/cache-manager'
import { handleError } from '@/lib/services/error-handler'
```

#### Type System
```typescript
// Shared TypeScript types
import type { TransactionWithRelations } from '@/lib/types/transaction.types'
import type { AccountWithBalance } from '@/lib/types/account.types'
```

#### Cache Strategy
```typescript
// Centralized cache management
- Dashboard: 10 second cache
- Transactions: Tag-based invalidation
- Accounts: Automatic refresh on mutations
```

---

## 🔐 Security

### Implemented Security Measures

- ✅ **Row Level Security (RLS)**: 160+ policies protecting 38+ tables
- ✅ **Content Security Policy**: Strict CSP headers
- ✅ **Rate Limiting**: API endpoint protection
- ✅ **Data Encryption**: Sensitive data encrypted at rest
- ✅ **Secure Headers**: HSTS, X-Frame-Options, etc.
- ✅ **Authentication**: Supabase Auth with email verification
- ✅ **Authorization**: Role-based access control
- ✅ **Security Logging**: Audit trail for critical actions

### Best Practices

```typescript
// Always validate input
import { validateOrThrow } from '@/lib/services/error-handler'
validateOrThrow(condition, "Invalid input")

// Check ownership before mutations
import { requireTransactionOwnership } from '@/lib/utils/security'
await requireTransactionOwnership(transactionId)

// Use encrypted storage for sensitive data
import { encryptAmount } from '@/lib/utils/transaction-encryption'
const encrypted = encryptAmount(amount)
```

---

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:reset         # Reset database

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run type-check       # TypeScript check
```

### Development Workflow

1. **Create a new feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow TypeScript strict mode
   - Use existing patterns and services
   - Add tests for new functionality

3. **Run quality checks**
   ```bash
   npm run lint
   npm run type-check
   npm run test
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

5. **Create a pull request**

---

## 🧪 Testing

### Test Structure

```
tests/
├── security.test.ts              # Security tests
├── subscription-helpers.test.ts  # Subscription logic
└── subscription-scenarios.test.ts # Billing scenarios
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test security.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

```typescript
import { calculateTotalIncome } from '@/lib/services/transaction-calculations'

describe('Transaction Calculations', () => {
  it('should calculate total income correctly', () => {
    const transactions = [
      { type: 'income', amount: 1000 },
      { type: 'income', amount: 500 },
    ]
    
    expect(calculateTotalIncome(transactions)).toBe(1500)
  })
})
```

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect your repository** to Vercel
2. **Configure environment variables** in Vercel dashboard
3. **Deploy** automatically on push to main

### Manual Deployment

```bash
# Build
npm run build

# Start production server
npm run start
```

### Environment Configuration

Ensure all environment variables are set:
- Supabase credentials
- Stripe keys
- Plaid credentials
- OpenAI API key (optional)
- Encryption key

---

## 📚 Documentation

### Available Documentation

- 📊 **[Complete Analysis](docs/SPARE_FINANCE_ANALISE_COMPLETA.md)** - Full project analysis
- 🏗️ **[Architecture Guide](docs/)** - Architecture decisions
- 🗄️ **[Database Schema](docs/ANALISE_BANCO.md)** - Database structure
- 🐳 **[Docker Setup](README_DOCKER.md)** - Docker configuration
- 🧪 **[Testing Guide](README_TESTS.md)** - Testing documentation

### API Documentation

API routes are organized by feature:
- `/api/transactions` - Transaction management
- `/api/accounts` - Account operations
- `/api/budgets` - Budget tracking
- `/api/goals` - Financial goals
- `/api/plaid` - Bank integration
- `/api/stripe` - Payment processing

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests**
5. **Update documentation**
6. **Submit a pull request**

### Code Style

- Follow TypeScript best practices
- Use consistent naming conventions
- Add JSDoc comments for functions
- Keep functions small and focused
- Write meaningful commit messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

**Developer**: Naor Tartarotti  
**Repository**: [github.com/naortartarotti/spare-finance](https://github.com/naortartarotti/spare-finance)

---

## 🙏 Acknowledgments

- **Next.js** team for the amazing framework
- **Supabase** for the excellent backend platform
- **Radix UI** for accessible components
- **Vercel** for hosting and deployment
- **Open source community** for inspiration and tools

---

## 📞 Support

- 📧 **Email**: [your-email@example.com]
- 🐛 **Issues**: [GitHub Issues](https://github.com/naortartarotti/spare-finance/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/naortartarotti/spare-finance/discussions)

---

## 🗺️ Roadmap

### Phase 1: Stabilization ✅
- [x] Core features implemented
- [x] Service layer architecture
- [x] Type system
- [x] Cache management
- [x] Error handling

### Phase 2: Optimization (Current)
- [x] Database optimizations
- [x] Performance improvements
- [ ] Redis implementation
- [ ] Test coverage >70%

### Phase 3: Expansion
- [ ] Mobile app
- [ ] More integrations
- [ ] Advanced AI features
- [ ] Internationalization

---

**Made with ❤️ by Naor Tartarotti**

*Last updated: November 16, 2024*

