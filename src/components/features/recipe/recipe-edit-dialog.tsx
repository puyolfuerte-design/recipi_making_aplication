'use client'

import { useActionState, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { updateRecipe } from '@/services/recipes'
import type { RecipeResult } from '@/services/recipes'
import type { Database } from '@/types/supabase'

type Recipe = Database['public']['Tables']['recipes']['Row']

type RecipeEditDialogProps = {
  recipe: Recipe
  onUpdate?: () => void
}

export function RecipeEditDialog({ recipe, onUpdate }: RecipeEditDialogProps) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState<RecipeResult, FormData>(
    async (_prevState, formData) => {
      const result = await updateRecipe(recipe.id, formData)
      if (result.success) {
        toast.success('レシピを更新しました')
        setOpen(false)
        onUpdate?.()
      } else {
        toast.error(result.error || '更新に失敗しました')
      }
      return result
    },
    { success: false }
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-gray-600 hover:bg-gray-50"
      >
        <Pencil className="h-3 w-3" />
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>レシピを編集</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* タイトル */}
          <div className="space-y-1">
            <label htmlFor="edit-title" className="text-sm font-medium">
              タイトル <span className="text-red-500">*</span>
            </label>
            <Input
              id="edit-title"
              name="title"
              defaultValue={recipe.title}
              disabled={pending}
              required
            />
          </div>

          {/* 説明 */}
          <div className="space-y-1">
            <label htmlFor="edit-description" className="text-sm font-medium">
              説明
            </label>
            <textarea
              id="edit-description"
              name="description"
              defaultValue={recipe.description ?? ''}
              disabled={pending}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* メモ */}
          <div className="space-y-1">
            <label htmlFor="edit-memo" className="text-sm font-medium">
              メモ
            </label>
            <textarea
              id="edit-memo"
              name="memo"
              defaultValue={recipe.memo ?? ''}
              disabled={pending}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {state.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {state.error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
