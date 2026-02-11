'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTagId, setLoadingTagId] = useState<string | null>(null)

  const selectedTags = availableTags.filter((tag) =>
    selectedTagIds.includes(tag.id)
  )
  const unselectedTags = availableTags.filter(
    (tag) => !selectedTagIds.includes(tag.id)
  )

  // 既存タグをレシピに追加
  const handleAddTag = async (tagId: string) => {
    setLoadingTagId(tagId)
    const result = await addTagToRecipe(recipeId, tagId)
    setLoadingTagId(null)

    if (result.success) {
      setOpen(false)
      setInputValue('')
      onUpdate?.()
    } else {
      toast.error(result.error || 'タグの追加に失敗しました')
    }
  }

  // 新しいタグを作成してレシピに追加
  const handleCreateTag = async (name: string) => {
    if (!name.trim()) return

    setIsLoading(true)
    const result = await createTag(name.trim())
    setIsLoading(false)

    if (result.success && result.tag) {
      toast.success(`タグ「${result.tag.name}」を作成しました`)
      await addTagToRecipe(recipeId, result.tag.id)
      setOpen(false)
      setInputValue('')
      onUpdate?.()
    } else {
      toast.error(result.error || 'タグの作成に失敗しました')
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

  // 入力値と一致する未選択タグ（大文字小文字を無視）
  const filteredTags = unselectedTags.filter((tag) =>
    tag.name.toLowerCase().includes(inputValue.toLowerCase())
  )

  // 入力値と完全一致するタグが存在するかチェック
  const exactMatch = availableTags.some(
    (tag) => tag.name.toLowerCase() === inputValue.toLowerCase().trim()
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

        {/* タグ追加 Combobox */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Badge
              variant="outline"
              className="cursor-pointer border-dashed hover:bg-gray-100"
            >
              <Plus className="mr-1 h-3 w-3" />
              タグを追加
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="タグを検索または作成..."
                value={inputValue}
                onValueChange={setInputValue}
              />
              <CommandList>
                {/* 既存タグの候補 */}
                {filteredTags.length > 0 && (
                  <CommandGroup heading="既存タグ">
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.id}
                        onSelect={() => handleAddTag(tag.id)}
                        disabled={loadingTagId === tag.id}
                      >
                        {loadingTagId === tag.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Tag className="mr-2 h-4 w-4" />
                        )}
                        {tag.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* 新規作成アクション */}
                {inputValue.trim() && !exactMatch && (
                  <CommandGroup heading="新規作成">
                    <CommandItem
                      value={`__create__${inputValue}`}
                      onSelect={() => handleCreateTag(inputValue)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      &ldquo;{inputValue.trim()}&rdquo; を作成する
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* 完全一致かつ未選択の場合は追加ボタンを表示 */}
                {inputValue.trim() && exactMatch && filteredTags.length === 0 && (
                  <CommandEmpty>タグはすでに追加済みです</CommandEmpty>
                )}

                {/* 入力なし・候補なし */}
                {!inputValue.trim() && unselectedTags.length === 0 && (
                  <CommandEmpty>追加できるタグがありません</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
