'use client'

import { useActionState } from 'react'
import { signIn, signUp, type AuthResult } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AuthFormProps = {
  mode: 'signin' | 'signup'
}

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === 'signin' ? signIn : signUp
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (_prevState, formData) => action(formData),
    { success: false }
  )

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === 'signin' ? 'ログイン' : '新規登録'}</CardTitle>
        <CardDescription>
          {mode === 'signin'
            ? 'Recipe Stockにログインしてください'
            : 'Recipe Stockのアカウントを作成してください'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                表示名 (任意)
              </label>
              <Input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="山田太郎"
                disabled={pending}
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              メールアドレス
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="example@example.com"
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              パスワード
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••"
              required
              disabled={pending}
            />
          </div>

          {state.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? '処理中...'
              : mode === 'signin'
                ? 'ログイン'
                : '新規登録'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
