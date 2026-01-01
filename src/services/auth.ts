'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { z } from 'zod'

// バリデーションスキーマ
const signUpSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(6, { message: 'パスワードは6文字以上である必要があります' }),
  displayName: z.string().min(1, { message: '表示名を入力してください' }).optional(),
})

const signInSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(1, { message: 'パスワードを入力してください' }),
})

export type AuthResult = {
  success: boolean
  error?: string
}

/**
 * サインアップ
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    displayName: formData.get('displayName') as string | undefined,
  }

  // バリデーション
  const validationResult = signUpSchema.safeParse(rawData)
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]
    return {
      success: false,
      error: firstError?.message || 'バリデーションエラー',
    }
  }

  const { email, password, displayName } = validationResult.data

  const supabase = await createClient()

  // ユーザー登録
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
      },
    },
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * サインイン
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  // バリデーション
  const validationResult = signInSchema.safeParse(rawData)
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]
    return {
      success: false,
      error: firstError?.message || 'バリデーションエラー',
    }
  }

  const { email, password } = validationResult.data

  const supabase = await createClient()

  // サインイン
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * サインアウト
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()

  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
