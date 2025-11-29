# Project Rules for Cursor

This file contains project-specific rules that Cursor should follow when working on this codebase.

## Architecture

This project follows **Clean Architecture** with **Domain-Driven Design (DDD)**. Always maintain strict layer separation.

## Layer Dependencies (NEVER VIOLATE)

```
Domain → (no dependencies)
Application → Domain only
Infrastructure → Domain, Application
Presentation → Domain, Application (via factories)
```

**FORBIDDEN:**
- Presentation → Infrastructure (direct database access)
- Application → Presentation
- Domain → Any other layer

## When Creating New Features

1. **Start with Domain**: Create types and validations
2. **Then Infrastructure**: Create repository for data access
3. **Then Application**: Create service with business logic
4. **Finally Presentation**: Create API routes and components

## When Migrating Code

- Replace `get*Client()` calls with `fetch("/api/v2/<feature>")`
- Remove imports from `lib/api/*-client.ts`
- Ensure API routes use `makeFeatureService()` factories
- Never put business logic in API routes or components

## Code Patterns

### API Routes
- Always use `makeFeatureService()` factory
- Always check authentication with `getCurrentUserId()`
- Never put business logic in routes
- Add cache headers for GET requests

### Client Components
- Always use `fetch("/api/v2/<feature>")`
- Never use `get*Client()` functions
- Always handle loading and error states

### Services
- All business logic goes here
- Use repositories for data access
- Validate using domain schemas

## Common Mistakes to Avoid

- ❌ Business logic in API routes
- ❌ Direct database access from components
- ❌ Using client-side APIs (`*-client.ts`)
- ❌ Skipping validation

See `.cursorrules` for complete rules and patterns.

