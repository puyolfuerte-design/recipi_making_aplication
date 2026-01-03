import { Suspense } from 'react'
import { getCurrentUser } from '@/services/auth'
import { getRecipes } from '@/services/recipes'
import { getTags } from '@/services/tags'
import { signOut } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { RecipeForm } from '@/components/features/recipe/recipe-form'
import { RecipeList } from '@/components/features/recipe/recipe-list'
import { RecipeListSkeleton } from '@/components/features/recipe/recipe-skeleton'
import { LogOut, User } from 'lucide-react'

// レシピ一覧を取得するServer Component
async function RecipeListContainer() {
  const [recipes, tags] = await Promise.all([getRecipes(), getTags()])
  return <RecipeList recipes={recipes} availableTags={tags} />
}

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <h1 className="text-xl font-bold text-gray-900">Recipe Stock</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.email}</span>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">ログアウト</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-8">
          {/* レシピ登録フォーム */}
          <section>
            <RecipeForm />
          </section>

          {/* レシピ一覧 */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              登録済みレシピ
            </h2>
            <Suspense fallback={<RecipeListSkeleton />}>
              <RecipeListContainer />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  )
}
