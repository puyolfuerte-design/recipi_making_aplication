import Link from 'next/link'
import { AuthForm } from '@/components/features/auth/auth-form'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4">
        <AuthForm mode="signup" />
        <p className="text-center text-sm text-gray-600">
          すでにアカウントをお持ちですか?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
