# Contributing

## Before You Start

1. Read `AGENTS.md` for project architecture and code rules
2. Check existing issues — avoid duplicates
3. For large changes, open an issue first to discuss the approach

## Branch Naming

```
feat/user-profile-page
fix/token-refresh-race
chore/update-deps
docs/api-reference
```

Format: `<type>/<short-description>`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add passkey reauthentication
fix: resolve token expiry race condition
chore: update prisma to 7.9
docs: add webhook configuration guide
refactor: extract session validation logic
test: add coverage for OAuth callback
```

One change per commit. No `fix stuff` or `wip` commits.

## Pull Request Rules

### Title

Same format as commits: `feat: add passkey reauthentication`

### Description

Must include:

- **What** changed
- **Why** it changed
- **How** to test it (if applicable)

Example:

```
### What
Added passkey reauthentication flow for high-risk operations.

### Why
Users need to verify identity before sensitive actions (password change, email update).

### How to test
1. Register a passkey
2. Attempt to change password
3. Verify passkey prompt appears
4. Confirm passkey flow completes successfully
```

### Checklist

Before requesting review:

- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (if tests exist)
- [ ] No TypeScript errors
- [ ] Changes are in correct packages (no cross-package leaks)
- [ ] New env vars added to `.env.example`
- [ ] API changes reflected in route docs (if applicable)
- [ ] UI changes work on mobile and desktop

## Code Rules

### File Structure

- Components: `PascalCase.tsx`
- Hooks: `use*.ts`
- Utils: `camelCase.ts`
- Types: `types.ts` or inline
- Validation: `validation.ts`

### Imports

```typescript
// Correct
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@neo-id/shared";

// Wrong
import { Button } from "../../../components/ui/Button";
```

### Components

- One component per file
- Props interface in same file or imported from `types.ts`
- Use `className` for customization, not separate component variants
- Server Components by default, `"use client"` only when needed

### API

- Validate all inputs with Zod
- Return standard response format: `{ ok, data, meta }`
- Use error codes from `@neo-id/shared`, not custom strings

### Database

- Migrations only via `pnpm db:migrate`
- No raw SQL in application code
- Use Prisma Client for all queries

## Review Process

1. At least 1 approval required
2. All CI checks must pass
3. Reviewer requests changes if:
   - Code violates rules in `AGENTS.md`
   - Missing tests for new features
   - Breaking changes without discussion
   - Security concerns

## After Your PR is Merged

- Delete your feature branch
- Pull latest `main`
- Verify your changes work in the deployed environment
