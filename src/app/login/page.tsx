import Link from 'next/link'
import { AuthForm } from '@/components/features/auth/auth-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4">
        <AuthForm mode="signin" />
        <p className="text-center text-sm text-gray-600">
          アカウントをお持ちでないですか?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  )
}
