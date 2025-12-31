# Project: Recipe Stock (VibeCoding Guidelines)

## 1. Communication & Language
- Language: ALWAYS respond in Japanese.
- Tone: Professional, technical, and concise. (丁寧な日本語、かつエンジニアらしい簡潔な表現)
- Feedback: If the user's request is ambiguous, ask for clarification in Japanese.

## 2. Tech Stack & Architecture
- Framework: Next.js (App Router)
- Component Logic: Default to RSC (Server Components). Use 'use client' ONLY for interactive leaf components.
- UI: Tailwind CSS + shadcn/ui (Keep components in src/components/ui)
- Database/Auth: Supabase (PostgreSQL) with Row Level Security (RLS)
- Validation: Zod + TypeScript (Strict mode, No 'any')

## 3. Directory Structure
- `src/app/`: Routing & Pages
- `src/components/ui/`: Base shadcn components
- `src/components/features/`: Domain-specific components
- `src/lib/`: Shared utilities & Supabase client
- `src/services/`: Server-side logic & scraping (Server Actions)
- `src/types/`: TypeScript definitions (including Supabase generated types)

## 4. Implementation Rules
- Database: All tables MUST have RLS policies. User data must be isolated by `auth.uid()`.
- Error Handling: Use error.tsx for global errors and shadcn Toast for user notifications.
- Loading: Implement Skeleton screens for async data fetching.
- Scraping: Use `open-graph-scraper`. Always provide a manual entry fallback if scraping fails.
- Typing: Run `npm run update-types` after any schema change and use generated types.

## 5. Work Flow
1. Check existing types and components before creating new ones.
2. Maintain `src/lib/supabase.ts` for both client and server usage.
3. Always verify RLS policy safety when writing database operations.