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
   # New format (recommended): sb_publishable_...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   # Legacy format (still supported): anon JWT key
   # NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # New format (recommended): sb_secret_...
   SUPABASE_SECRET_KEY=sb_secret_...
   # Legacy format (still supported): service_role JWT key
   # SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   
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
│   ├── api/                     # API routes
│   │   ├── v2/                  # API routes (Clean Architecture) ✅
│   │   └── ...                  # Legacy routes (deprecated, use v2)
│   ├── auth/                    # Login/Signup pages
│   └── page.tsx                 # Landing page
│
├── src/                          # Source code (Clean Architecture) ✅
│   ├── domain/                   # Domain Layer - Types, validations, constants
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── budgets/
│   │   └── ...                   # One folder per feature
│   │
│   ├── application/              # Application Layer - Business logic
│   │   ├── accounts/
│   │   │   ├── accounts.service.ts
│   │   │   ├── accounts.mapper.ts
│   │   │   └── accounts.factory.ts
│   │   ├── transactions/
│   │   └── ...                   # One folder per feature
│   │
│   ├── infrastructure/           # Infrastructure Layer - Data access, external services
│   │   ├── database/
│   │   │   └── repositories/    # Database repositories
│   │   ├── external/            # Stripe, OpenAI
│   │   └── utils/               # Utilities, cache, security
│   │
│   └── presentation/            # Presentation Layer - UI, hooks, API routes
│       ├── components/
│       └── hooks/
│
├── components/                   # React Components
│   ├── ui/                      # Base UI components
│   ├── dashboard/               # Dashboard widgets
│   ├── forms/                   # Reusable forms
│   └── common/                  # Shared components
│
├── lib/                         # Utility libraries
│   ├── services/                # Utility services (not business logic)
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

This project follows **Clean Architecture** with **Domain-Driven Design (DDD)** principles, organized into four distinct layers with clear separation of concerns.

> 📖 **For detailed architecture rules and patterns, see [`.cursorrules`](.cursorrules)** - This is the source of truth for all architectural decisions.

### Architecture Layers

#### 1. Domain Layer (`src/domain/`)
**Purpose**: Pure business domain - types, validations, and constants
- ✅ Contains only TypeScript types/interfaces
- ✅ Zod validation schemas
- ✅ Domain constants
- ✅ Zero dependencies (except Zod)
- ❌ No business logic, no infrastructure, no UI

**Example:**
```typescript
// src/domain/accounts/types.ts
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

// src/domain/accounts/validations.ts
import { z } from 'zod';
export const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['checking', 'savings', 'credit']),
});
```

#### 2. Application Layer (`src/application/`)
**Purpose**: Business logic and orchestration
- ✅ All business logic lives here
- ✅ Uses repositories from Infrastructure layer
- ✅ Validates using Domain schemas
- ✅ Returns Domain types
- ❌ No direct database access, no UI, no HTTP concerns

**Example:**
```typescript
// src/application/accounts/accounts.service.ts
import { AccountsRepository } from '@/src/infrastructure/database/repositories/accounts.repository';
import { Account } from '@/src/domain/accounts/types';
import { accountSchema } from '@/src/domain/accounts/validations';

export class AccountsService {
  constructor(private repository: AccountsRepository) {}
  
  async getAll(userId: string): Promise<Account[]> {
    return this.repository.findAll(userId);
  }
  
  async create(userId: string, data: unknown): Promise<Account> {
    const validated = accountSchema.parse(data);
    return this.repository.create(userId, validated);
  }
}
```

#### 3. Infrastructure Layer (`src/infrastructure/`)
**Purpose**: Data access and external services
- ✅ Database repositories (data access only)
- ✅ External service integrations (Stripe, OpenAI)
- ✅ Cache, security, utilities
- ❌ No business logic (must be in Application layer)

**Example:**
```typescript
// src/infrastructure/database/repositories/accounts.repository.ts
import { createServerClient } from '@/src/infrastructure/database/supabase-server';
import { Account } from '@/src/domain/accounts/types';

export class AccountsRepository {
  async findAll(userId: string): Promise<Account[]> {
    const supabase = await createServerClient();
    const { data } = await supabase.from('Account').select('*').eq('userId', userId);
    return data.map(this.mapToDomain);
  }
  
  private mapToDomain(row: any): Account {
    return { id: row.id, name: row.name, /* ... */ };
  }
}
```

#### 4. Presentation Layer (`src/presentation/` + `app/`)
**Purpose**: UI components, hooks, and API routes
- ✅ React components and hooks
- ✅ API routes (thin HTTP layer)
- ✅ Uses Application Services via factories
- ❌ No business logic, no direct database access

**Example:**
```typescript
// app/api/v2/accounts/route.ts
import { makeAccountsService } from '@/src/application/accounts/accounts.factory';
import { getCurrentUserId } from '@/src/application/shared/feature-guard';

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const service = makeAccountsService();
  const accounts = await service.getAll(userId);
  
  return NextResponse.json(accounts);
}
```

### Design Principles

1. **Separation of Concerns**: Clear separation between UI, business logic, and data
2. **Dependency Inversion**: Inner layers don't depend on outer layers
3. **Type Safety**: TypeScript everywhere with strict mode
4. **Security First**: RLS policies, encryption, rate limiting
5. **Performance**: Caching, code splitting, optimized queries
6. **Maintainability**: Clean code, consistent patterns, documentation

### Golden Rules

1. **Business logic → Application Services ONLY**
2. **Data access → Repositories ONLY**
3. **Client components → API Routes (`/api/v2/<feature>`)**
4. **Server components → Application Services (via factories)**
5. **NEVER direct database access from Presentation Layer**
6. **NEVER business logic in API routes or components**

### Migration Status

✅ **Migration Complete!** The project has been fully migrated to Clean Architecture:
- ✅ All features use Clean Architecture (`src/` structure)
- ✅ All legacy code from `lib/api/` has been migrated to Application Services
- ✅ All API routes follow the `/api/v2/` pattern using Application Services
- ✅ 32 features completely migrated
- ✅ 17 legacy files removed

**All new code must follow the Clean Architecture pattern described above.**

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
// Always validate input using Domain schemas
import { accountSchema } from '@/src/domain/accounts/validations'
const validated = accountSchema.parse(data)

// Use Application Services for business logic
import { makeAccountsService } from '@/src/application/accounts/accounts.factory'
const service = makeAccountsService()
const account = await service.create(userId, validated)

// Use AppError for expected errors
import { AppError } from '@/src/application/shared/app-error'
if (!account) {
  throw new AppError('Account not found', 404)
}
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
import { makeTransactionsService } from '@/src/application/transactions/transactions.factory'

describe('Transactions Service', () => {
  it('should calculate total income correctly', async () => {
    const service = makeTransactionsService()
    const transactions = await service.getTransactions(userId, {
      type: 'income',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    })
    
    const total = transactions.reduce((sum, tx) => sum + tx.amount, 0)
    expect(total).toBe(1500)
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
- OpenAI API key (optional)
- Encryption key

---

## 📚 Documentation

### Available Documentation

- 📊 **[Complete Project Analysis](docs/ANALISE_PROJETO_COMPLETA.md)** - Comprehensive analysis of architecture, issues, and recommendations
- 🏗️ **[Architecture Rules](.cursorrules)** - Source of truth for all architectural patterns and rules
- ✅ **[Migration Complete Report](docs/MIGRATION_COMPLETE_REPORT.md)** - Full report on the completed migration to Clean Architecture
- 📋 **[Architecture Migration Status](docs/ARCHITECTURE_MIGRATION_STATUS.md)** - Detailed status of all migrated features
- 🗄️ **[Database Schema](docs/ANALISE_BANCO.md)** - Database structure
- 🐳 **[Docker Setup](README_DOCKER.md)** - Docker configuration
- 🧪 **[Testing Guide](README_TESTS.md)** - Testing documentation

### API Documentation

API routes are organized by feature. **All routes follow the `/api/v2/` pattern** using Clean Architecture:

**API Routes (Clean Architecture):**
- `/api/v2/transactions` - Transaction management
- `/api/v2/accounts` - Account operations
- `/api/v2/budgets` - Budget tracking
- `/api/v2/goals` - Financial goals
- `/api/v2/categories` - Category management
- `/api/v2/debts` - Debt tracking
- `/api/v2/members` - Household member management
- `/api/v2/billing` - Billing and subscriptions
- `/api/v2/profile` - User profile management
- And many more...

**Legacy / other API:**
- Remaining `app/api/` routes (e.g. billing, stripe, auth, admin) — use v2 where available.
- `/api/v2/*` is the preferred pattern for new and migrated features.

> 📖 **Note**: All new API routes must use the `/api/v2/` pattern and Application Services. See [`.cursorrules`](.cursorrules) for detailed patterns.

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
- [x] Clean Architecture + DDD structure
- [x] Domain layer with types and validations
- [x] Application layer with services
- [x] Infrastructure layer with repositories
- [x] Cache management
- [x] Error handling

### Phase 2: Migration & Optimization ✅
- [x] Clean Architecture structure implemented
- [x] New API routes (`/api/v2/`) following architecture
- [x] Complete migration from legacy `lib/api/` to `src/application/` ✅
- [x] Migrate all components to use `/api/v2/` routes ✅
- [x] Update all server components to use Application Services ✅
- [x] Remove all legacy files (17 files deleted) ✅
- [ ] Redis implementation
- [ ] Test coverage >70%

### Phase 3: Expansion
- [ ] Mobile app
- [ ] More integrations
- [ ] Advanced AI features
- [ ] Internationalization

---

## 🎉 Recent Updates

### ✅ Architecture Migration Complete (December 2024)

The project has been fully migrated to **Clean Architecture + Domain-Driven Design (DDD)**:

- ✅ **32 features** completely migrated to Application Services
- ✅ **17 legacy files** removed from `lib/api/`
- ✅ **All API routes** now follow `/api/v2/` pattern
- ✅ **100% compliance** with Clean Architecture principles
- ✅ **Zero legacy dependencies** remaining

All new development follows the established Clean Architecture patterns. See [Migration Complete Report](docs/MIGRATION_COMPLETE_REPORT.md) for details.

---

**Made with ❤️ by Naor Tartarotti**

*Last updated: December 2024*

