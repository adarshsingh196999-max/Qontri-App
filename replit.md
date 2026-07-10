# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### SplitEase – Group Expense Splitter (Mobile App)
- **Location**: `artifacts/mobile/`
- **Tech**: Expo React Native
- **Description**: Group expense splitting mobile app with:
  - Groups management (create, invite members, manage)
  - Expense tracking (equal, unequal, percentage, exact splits)
  - Real-time balance calculation with debt simplification
  - Settlement recording (cash, UPI, bank transfer)
  - Activity feed
  - Profile settings
- **State**: AsyncStorage (local persistence)
- **Auth**: Clerk (phone number + OTP). Configured via Replit Auth pane. Phone number login must be enabled in Auth pane. Env vars: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`. Mobile uses `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (set in dev script from `$CLERK_PUBLISHABLE_KEY`).
- **Key Files**:
  - `context/AppContext.tsx` — all app state, data logic (uses Clerk userId)
  - `app/(auth)/_layout.tsx` — auth route group (redirects if signed in)
  - `app/(auth)/sign-in.tsx` — phone + OTP login screen
  - `app/(tabs)/_layout.tsx` — redirects to sign-in if not authenticated
  - `app/(tabs)/index.tsx` — groups list
  - `app/(tabs)/activity.tsx` — activity feed
  - `app/(tabs)/profile.tsx` — profile/settings (sign-out button)
  - `app/group/[id].tsx` — group detail (expenses + balances tabs)
  - `app/group/add-expense.tsx` — add expense with split types
  - `app/group/new.tsx` — create group
  - `app/group/settle.tsx` — record settlement
  - `constants/colors.ts` — teal/green theme tokens
- **API Server**: Clerk proxy middleware at `/api/__clerk` (production only), CORS enabled
