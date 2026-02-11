'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { deleteRecipe } from '@/services/recipes'
import { TagManager } from './tag-manager'
import { RecipeEditDialog } from './recipe-edit-dialog'
import {
  ExternalLink,
  ImageOff,
  Trash2,
  Loader2,
  FileText,
  Link2,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/supabase'

type Recipe = Database['public']['Tables']['recipes']['Row']
type TagType = Database['public']['Tables']['tags']['Row']

type RecipeCardProps = {
  recipe: Recipe
  availableTags: TagType[]
  selectedTagIds: string[]
  onUpdate?: () => void
}

export function RecipeCard({
  recipe,
  availableTags,
  selectedTagIds,
  onUpdate,
}: RecipeCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteRecipe(recipe.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success('レシピを削除しました')
      onUpdate?.()
    } else {
      toast.error(result.error || '削除に失敗しました')
    }
    setShowConfirm(false)
  }

  const formattedDate = recipe.created_at
    ? new Date(recipe.created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''

  const selectedTags = availableTags.filter((tag) =>
    selectedTagIds.includes(tag.id)
  )

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* 画像エリア */}
      <div className="relative h-40 w-full bg-gray-100">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* 手動/URL バッジ */}
        <div className="absolute left-2 top-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              recipe.is_manual
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {recipe.is_manual ? (
              <>
                <FileText className="mr-1 h-3 w-3" />
                手動
              </>
            ) : (
              <>
                <Link2 className="mr-1 h-3 w-3" />
                URL
              </>
            )}
          </span>
        </div>
      </div>

      <CardHeader className="flex-1 pb-2">
        <CardTitle className="line-clamp-2 text-base">{recipe.title}</CardTitle>
        {recipe.description && (
          <CardDescription className="line-clamp-2 text-sm">
            {recipe.description}
          </CardDescription>
        )}
      </CardHeader>

      {/* タグ表示 */}
      <CardContent className="pb-2 pt-0">
        <div className="space-y-2">
          {/* 選択中のタグを表示 */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-xs">
                  <Tag className="mr-1 h-3 w-3" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* タグ管理 Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center text-xs text-gray-500 hover:text-gray-700">
                <Tag className="mr-1 h-3 w-3" />
                タグを編集
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <TagManager
                recipeId={recipe.id}
                availableTags={availableTags}
                selectedTagIds={selectedTagIds}
                onUpdate={onUpdate}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>

      {recipe.memo && (
        <CardContent className="pb-2 pt-0">
          <div className="rounded-md bg-yellow-50 p-2">
            <p className="line-clamp-2 text-xs text-yellow-800">
              メモ: {recipe.memo}
            </p>
          </div>
        </CardContent>
      )}

      <CardFooter className="flex flex-col items-stretch gap-2 pt-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formattedDate}</span>
        </div>
        <div className="flex gap-2">
          {recipe.url && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-1"
            >
              <a
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                レシピを見る
              </a>
            </Button>
          )}
          <RecipeEditDialog recipe={recipe} onUpdate={onUpdate} />
          {!showConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(true)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  '削除'
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
              >
                取消
              </Button>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
