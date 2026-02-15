'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeCard } from './recipe-card'
import { TagFilter } from './tag-filter'
import { Input } from '@/components/ui/input'
import { UtensilsCrossed, Search } from 'lucide-react'
import type { Database } from '@/types/supabase'

type Tag = Database['public']['Tables']['tags']['Row']

type RecipeTag = {
  tag_id: string
  tags: { id: string; name: string } | null
}

type RecipeWithTags = Database['public']['Tables']['recipes']['Row'] & {
  recipe_tags?: RecipeTag[]
}

type RecipeListProps = {
  recipes: RecipeWithTags[]
  availableTags: Tag[]
}

export function RecipeList({ recipes, availableTags }: RecipeListProps) {
  const router = useRouter()
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleUpdate = () => {
    router.refresh()
  }

  // タグ + 検索語でフィルタリング
  const filteredRecipes = recipes.filter((recipe) => {
    // 条件A: タグフィルター
    if (selectedTagId && !recipe.recipe_tags?.some((rt) => rt.tag_id === selectedTagId)) {
      return false
    }
    // 条件B: 検索語フィルター
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const hit =
        recipe.title?.toLowerCase().includes(q) ||
        recipe.description?.toLowerCase().includes(q) ||
        recipe.memo?.toLowerCase().includes(q) ||
        recipe.ingredients?.toLowerCase().includes(q) ||
        recipe.instructions?.toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* 検索フィールド */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="レシピ名、材料、メモで検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* タグフィルター */}
      {availableTags.length > 0 && (
        <TagFilter
          tags={availableTags}
          selectedTagId={selectedTagId}
          onSelectTag={setSelectedTagId}
        />
      )}

      {/* レシピ一覧 */}
      {filteredRecipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UtensilsCrossed className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchQuery || selectedTagId ? '条件に一致するレシピはありません' : 'レシピがありません'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery || selectedTagId
              ? '検索語やタグを変更してみてください'
              : '上のフォームからレシピを追加してみましょう'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => {
            const tagIds =
              recipe.recipe_tags
                ?.map((rt) => rt.tags?.id)
                .filter((id): id is string => !!id) || []

            return (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                availableTags={availableTags}
                selectedTagIds={tagIds}
                onUpdate={handleUpdate}
              />
            )
          })}
        </div>
      )}

      {/* フィルタリング中の件数表示 */}
      {(selectedTagId || searchQuery) && filteredRecipes.length > 0 && (
        <p className="text-center text-sm text-gray-500">
          {filteredRecipes.length}件のレシピを表示中
        </p>
      )}
    </div>
  )
}
