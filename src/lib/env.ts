import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
})
