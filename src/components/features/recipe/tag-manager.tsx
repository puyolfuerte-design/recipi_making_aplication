'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  createTag,
  addTagToRecipe,
  removeTagFromRecipe,
} from '@/services/tags'
import { Plus, X, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/supabase'

type TagType = Database['public']['Tables']['tags']['Row']

type TagManagerProps = {
  recipeId: string
  availableTags: TagType[]
  selectedTagIds: string[]
  onUpdate?: () => void
}

export function TagManager({
  recipeId,
  availableTags,
  selectedTagIds,
  onUpdate,
}: TagManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [loadingTagId, setLoadingTagId] = useState<string | null>(null)

  // 新しいタグを作成
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    setIsCreating(true)
    const result = await createTag(newTagName.trim())
    setIsCreating(false)

    if (result.success && result.tag) {
      toast.success(`タグ「${result.tag.name}」を作成しました`)
      setNewTagName('')
      setIsAdding(false)
      // 作成したタグを即座にレシピに追加
      await addTagToRecipe(recipeId, result.tag.id)
      onUpdate?.()
    } else {
      toast.error(result.error || 'タグの作成に失敗しました')
    }
  }

  // レシピにタグを追加
  const handleAddTag = async (tagId: string) => {
    setLoadingTagId(tagId)
    const result = await addTagToRecipe(recipeId, tagId)
    setLoadingTagId(null)

    if (result.success) {
      onUpdate?.()
    } else {
      toast.error(result.error || 'タグの追加に失敗しました')
    }
  }

  // レシピからタグを削除
  const handleRemoveTag = async (tagId: string) => {
    setLoadingTagId(tagId)
    const result = await removeTagFromRecipe(recipeId, tagId)
    setLoadingTagId(null)

    if (result.success) {
      onUpdate?.()
    } else {
      toast.error(result.error || 'タグの削除に失敗しました')
    }
  }

  const selectedTags = availableTags.filter((tag) =>
    selectedTagIds.includes(tag.id)
  )
  const unselectedTags = availableTags.filter(
    (tag) => !selectedTagIds.includes(tag.id)
  )

  return (
    <div className="space-y-2">
      {/* 選択中のタグ */}
      <div className="flex flex-wrap gap-1">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="default"
            className="flex items-center gap-1"
          >
            <Tag className="h-3 w-3" />
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              disabled={loadingTagId === tag.id}
              className="ml-1 hover:text-red-200"
            >
              {loadingTagId === tag.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </Badge>
        ))}

        {/* 未選択のタグを追加 */}
        {unselectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="cursor-pointer hover:bg-gray-100"
            onClick={() => handleAddTag(tag.id)}
          >
            {loadingTagId === tag.id ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Plus className="mr-1 h-3 w-3" />
            )}
            {tag.name}
          </Badge>
        ))}

        {/* 新規タグ追加ボタン */}
        {!isAdding && (
          <Badge
            variant="outline"
            className="cursor-pointer border-dashed hover:bg-gray-100"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            新規タグ
          </Badge>
        )}
      </div>

      {/* 新規タグ入力フォーム */}
      {isAdding && (
        <div className="flex gap-2">
          <Input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="タグ名を入力..."
            className="h-8 text-sm"
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateTag()
              }
              if (e.key === 'Escape') {
                setIsAdding(false)
                setNewTagName('')
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleCreateTag}
            disabled={!newTagName.trim() || isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              '追加'
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsAdding(false)
              setNewTagName('')
            }}
            disabled={isCreating}
          >
            取消
          </Button>
        </div>
      )}
    </div>
  )
}
