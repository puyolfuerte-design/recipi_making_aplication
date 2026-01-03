'use client'

import { useState, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  createRecipeFromURL,
  createRecipeManually,
  previewRecipe,
  type RecipeResult,
} from '@/services/recipes'
import type { OGPData } from '@/services/ogp'
import { Link2, FileText, Loader2, ExternalLink, ImageOff } from 'lucide-react'
import { toast } from 'sonner'

type RecipeFormProps = {
  onSuccess?: () => void
}

export function RecipeForm({ onSuccess }: RecipeFormProps) {
  const [mode, setMode] = useState<'url' | 'manual'>('url')
  const [preview, setPreview] = useState<OGPData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  // URL登録用のフォームステート
  const [urlState, urlFormAction, urlPending] = useActionState<
    RecipeResult,
    FormData
  >(async (_prevState, formData) => {
    const result = await createRecipeFromURL(formData)
    if (result.success) {
      toast.success(`「${result.recipe?.title}」を登録しました`)
      setPreview(null)
      setUrlInput('')
      onSuccess?.()
    } else {
      toast.error(result.error)
    }
    return result
  }, { success: false })

  // 手動登録用のフォームステート
  const [manualState, manualFormAction, manualPending] = useActionState<
    RecipeResult,
    FormData
  >(async (_prevState, formData) => {
    const result = await createRecipeManually(formData)
    if (result.success) {
      toast.success(`「${result.recipe?.title}」を登録しました`)
      onSuccess?.()
    } else {
      toast.error(result.error)
    }
    return result
  }, { success: false })

  // URLプレビュー取得
  const handlePreview = async () => {
    if (!urlInput) return

    setIsLoadingPreview(true)
    const result = await previewRecipe(urlInput)
    setIsLoadingPreview(false)

    if (result.success && result.data) {
      setPreview(result.data)
    } else {
      toast.error(result.error || 'レシピ情報を取得できませんでした')
      setPreview(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>レシピを追加</CardTitle>
        <CardDescription>
          URLからレシピ情報を取得するか、手動で入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* モード切り替えタブ */}
        <div className="mb-6 flex gap-2">
          <Button
            type="button"
            variant={mode === 'url' ? 'default' : 'outline'}
            onClick={() => {
              setMode('url')
              setPreview(null)
            }}
            className="flex-1"
          >
            <Link2 className="mr-2 h-4 w-4" />
            URLから追加
          </Button>
          <Button
            type="button"
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => {
              setMode('manual')
              setPreview(null)
            }}
            className="flex-1"
          >
            <FileText className="mr-2 h-4 w-4" />
            手動入力
          </Button>
        </div>

        {/* URL入力モード */}
        {mode === 'url' && (
          <div className="space-y-4">
            {/* URL入力フィールド */}
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/recipe/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isLoadingPreview || urlPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={!urlInput || isLoadingPreview || urlPending}
              >
                {isLoadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '取得'
                )}
              </Button>
            </div>

            {/* プレビュー表示 */}
            {preview && (
              <div className="rounded-lg border bg-gray-50 p-4">
                <div className="flex gap-4">
                  {preview.image ? (
                    <img
                      src={preview.image}
                      alt={preview.title}
                      className="h-24 w-24 flex-shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-md bg-gray-200">
                      <ImageOff className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 line-clamp-2">
                      {preview.title}
                    </h3>
                    {preview.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {preview.description}
                      </p>
                    )}
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      元のページを開く
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* URL登録フォーム */}
            {preview && (
              <form action={urlFormAction} className="space-y-4">
                <input type="hidden" name="url" value={urlInput} />

                <div className="space-y-2">
                  <label htmlFor="url-memo" className="text-sm font-medium">
                    メモ (任意)
                  </label>
                  <textarea
                    id="url-memo"
                    name="memo"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="このレシピのメモを入力..."
                    disabled={urlPending}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={urlPending}>
                  {urlPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登録中...
                    </>
                  ) : (
                    'レシピを登録'
                  )}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* 手動入力モード */}
        {mode === 'manual' && (
          <form action={manualFormAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="manual-title" className="text-sm font-medium">
                タイトル <span className="text-red-500">*</span>
              </label>
              <Input
                id="manual-title"
                name="title"
                type="text"
                placeholder="レシピのタイトルを入力..."
                required
                disabled={manualPending}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="manual-description"
                className="text-sm font-medium"
              >
                説明 (任意)
              </label>
              <textarea
                id="manual-description"
                name="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="レシピの説明を入力..."
                disabled={manualPending}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="manual-memo" className="text-sm font-medium">
                メモ (任意)
              </label>
              <textarea
                id="manual-memo"
                name="memo"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="このレシピのメモを入力..."
                disabled={manualPending}
              />
            </div>

            {manualState.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {manualState.error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={manualPending}>
              {manualPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登録中...
                </>
              ) : (
                'レシピを登録'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
