import { getCurrentUser } from '@/services/auth'
import { signOut } from '@/services/auth'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-gray-900">Recipe Stock</h1>
          <p className="mt-2 text-gray-600">レシピ管理アプリへようこそ</p>

          <div className="mt-6 space-y-4">
            <div className="rounded-md bg-blue-50 p-4">
              <h2 className="font-semibold text-blue-900">ログイン中</h2>
              <p className="mt-1 text-sm text-blue-700">
                メールアドレス: {user?.email}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                ユーザーID: {user?.id}
              </p>
            </div>

            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full">
                ログアウト
              </Button>
            </form>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">
            次のステップ
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Step 4でレシピ登録機能を実装予定です
          </p>
        </div>
      </div>
    </div>
  )
}
