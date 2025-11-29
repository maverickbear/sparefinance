# Cursor Commands for SpareFinanceApp

## Quick Commands

### Create New Feature
```
Create a new feature following Clean Architecture:
1. Domain layer: types, validations
2. Infrastructure: repository
3. Application: service, mapper, factory
4. Presentation: API route, components
```

### Migrate Client-side API
```
Migrate this component from client-side API to API route:
1. Check if /api/v2/<feature> exists
2. Replace get*Client() with fetch("/api/v2/<feature>")
3. Add error handling and loading states
4. Remove client API imports
```

### Create API Route
```
Create an API route at /api/v2/<feature> that:
- Uses makeFeatureService() factory
- Checks authentication with getCurrentUserId()
- Handles errors properly
- Adds cache headers for GET requests
- Never contains business logic
```

### Create Service
```
Create an Application Service that:
- Uses repository for data access
- Contains all business logic
- Validates using domain schemas
- Returns domain types
- Has a factory function for dependency injection
```

### Create Repository
```
Create a Repository that:
- Only handles data access (CRUD)
- Uses createServerClient() for database
- Maps database to domain types
- Has no business logic
```

### Review Architecture Compliance
```
Review this code for Clean Architecture compliance:
- Check layer dependencies
- Verify business logic is in Application layer
- Ensure no direct database access from Presentation
- Confirm API routes use factories
```

