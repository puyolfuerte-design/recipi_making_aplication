'use client'

import { Badge } from '@/components/ui/badge'
import { Tag, X } from 'lucide-react'
import type { Database } from '@/types/supabase'

type TagType = Database['public']['Tables']['tags']['Row']

type TagFilterProps = {
  tags: TagType[]
  selectedTagId: string | null
  onSelectTag: (tagId: string | null) => void
}

export function TagFilter({ tags, selectedTagId, onSelectTag }: TagFilterProps) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-700">タグで絞り込み:</span>

      {/* 全て表示 */}
      <Badge
        variant={selectedTagId === null ? 'default' : 'outline'}
        className="cursor-pointer"
        onClick={() => onSelectTag(null)}
      >
        すべて
      </Badge>

      {/* タグ一覧 */}
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant={selectedTagId === tag.id ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => onSelectTag(selectedTagId === tag.id ? null : tag.id)}
        >
          <Tag className="mr-1 h-3 w-3" />
          {tag.name}
          {selectedTagId === tag.id && (
            <X className="ml-1 h-3 w-3" />
          )}
        </Badge>
      ))}
    </div>
  )
}
