'use client'

import { useState, useActionState, useRef } from 'react'
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
  createRecipeFromImage,
  previewRecipe,
  type RecipeResult,
} from '@/services/recipes'
import { extractRecipeFromImage, type ExtractedRecipeData } from '@/services/vision'
import { uploadRecipeImage } from '@/services/storage'
import type { OGPData } from '@/services/ogp'
import { Link2, FileText, Loader2, ExternalLink, ImageOff, Camera } from 'lucide-react'
import { toast } from 'sonner'

type RecipeFormProps = {
  onSuccess?: () => void
}

export function RecipeForm({ onSuccess }: RecipeFormProps) {
  const [mode, setMode] = useState<'url' | 'manual' | 'image'>('url')
  const [preview, setPreview] = useState<OGPData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  // 画像モード用のステート
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [compressedImageDataUrl, setCompressedImageDataUrl] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedRecipeData | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // 画像から登録用のフォームステート
  const [imageState, imageFormAction, imagePending] = useActionState<
    RecipeResult,
    FormData
  >(async (_prevState, formData) => {
    // 画像をアップロード
    let imageUrl: string | null = null
    if (compressedImageDataUrl) {
      const uploadResult = await uploadRecipeImage(compressedImageDataUrl)
      if (uploadResult.success && uploadResult.imageUrl) {
        imageUrl = uploadResult.imageUrl
        // FormDataに画像URLを追加
        formData.set('imageUrl', imageUrl)
      } else {
        toast.error(uploadResult.error || '画像のアップロードに失敗しました')
        // 画像アップロード失敗時も登録は続行（画像なしで登録）
      }
    }

    const result = await createRecipeFromImage(formData)
    if (result.success) {
      toast.success(`「${result.recipe?.title}」を登録しました`)
      // フォームリセット
      setSelectedImage(null)
      setCompressedImageDataUrl(null)
      setExtractedData(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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

  // 画像圧縮関数
  const compressImage = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }

          // 長辺を最大1200pxにリサイズ
          const maxSize = 1200
          let width = img.width
          let height = img.height

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          // JPEG形式で品質0.8で圧縮
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          resolve(dataUrl)
        }
        img.onerror = () => resolve(null)
        img.src = e.target?.result as string
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  // 画像選択ハンドラー
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('画像ファイルを選択してください')
      return
    }

    // プレビュー用にファイルURLを作成
    const imageUrl = URL.createObjectURL(file)
    setSelectedImage(imageUrl)

    // 画像を圧縮
    const compressed = await compressImage(file)
    if (compressed) {
      setCompressedImageDataUrl(compressed)
    } else {
      toast.error('画像の処理に失敗しました')
      setSelectedImage(null)
    }
  }

  // レシピ抽出ハンドラー
  const handleExtractRecipe = async () => {
    if (!compressedImageDataUrl) return

    setIsExtracting(true)
    const result = await extractRecipeFromImage(compressedImageDataUrl)
    setIsExtracting(false)

    if (result.success && result.data) {
      setExtractedData(result.data)
      toast.success('レシピ情報を読み取りました')
    } else {
      toast.error(result.error || 'レシピ情報を読み取れませんでした')
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
        <div className="mb-6 flex flex-col sm:flex-row gap-2">
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
            variant={mode === 'image' ? 'default' : 'outline'}
            onClick={() => {
              setMode('image')
              setPreview(null)
            }}
            className="flex-1"
          >
            <Camera className="mr-2 h-4 w-4" />
            画像から追加
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
              <form key={preview.url} action={urlFormAction} className="space-y-4">
                <input type="hidden" name="url" value={urlInput} />

                <div className="space-y-2">
                  <label htmlFor="url-ingredients" className="text-sm font-medium">
                    材料 (任意)
                  </label>
                  <textarea
                    id="url-ingredients"
                    name="ingredients"
                    defaultValue={preview.ingredients ?? ''}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="材料を1行ずつ入力..."
                    disabled={urlPending}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="url-instructions" className="text-sm font-medium">
                    手順 (任意)
                  </label>
                  <textarea
                    id="url-instructions"
                    name="instructions"
                    defaultValue={preview.instructions ?? ''}
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="手順を1行ずつ入力..."
                    disabled={urlPending}
                  />
                </div>

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

        {/* 画像読み取りモード */}
        {mode === 'image' && (
          <div className="space-y-4">
            {/* ファイル選択 */}
            <div className="space-y-3">
              <label htmlFor="image-file" className="block text-sm font-semibold text-gray-900">
                📷 レシピ画像を選択
              </label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 hover:border-gray-400 transition-colors">
                <Input
                  id="image-file"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={isExtracting || imagePending}
                  className="cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-xs text-gray-500">
                  カメラで撮影、またはギャラリーから選択してください
                </p>
              </div>
            </div>

            {/* 画像プレビュー */}
            {selectedImage && !extractedData && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-gray-50 p-4">
                  <img
                    src={selectedImage}
                    alt="選択した画像"
                    className="mx-auto max-h-[400px] rounded-md object-contain"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleExtractRecipe}
                  disabled={isExtracting || !compressedImageDataUrl}
                  className="w-full"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      読み取り中...
                    </>
                  ) : (
                    'レシピ情報を読み取る'
                  )}
                </Button>
              </div>
            )}

            {/* 抽出結果の編集フォーム */}
            {extractedData && (
              <form action={imageFormAction} className="space-y-4">
                <div className="rounded-lg border bg-blue-50 p-3 text-sm text-blue-800">
                  読み取った情報を確認・編集してください
                </div>

                {selectedImage && (
                  <div className="rounded-lg border bg-gray-50 p-2">
                    <img
                      src={selectedImage}
                      alt="選択した画像"
                      className="mx-auto max-h-[200px] rounded-md object-contain"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="image-title" className="text-sm font-medium">
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="image-title"
                    name="title"
                    type="text"
                    defaultValue={extractedData.title}
                    placeholder="レシピのタイトルを入力..."
                    required
                    disabled={imagePending}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="image-description" className="text-sm font-medium">
                    説明 (任意)
                  </label>
                  <textarea
                    id="image-description"
                    name="description"
                    defaultValue={extractedData.description}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="レシピの説明を入力..."
                    disabled={imagePending}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="image-ingredients" className="text-sm font-medium">
                    材料 (任意)
                  </label>
                  <textarea
                    id="image-ingredients"
                    name="ingredients"
                    defaultValue={extractedData.ingredients}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="材料を1行ずつ入力..."
                    disabled={imagePending}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="image-instructions" className="text-sm font-medium">
                    手順 (任意)
                  </label>
                  <textarea
                    id="image-instructions"
                    name="instructions"
                    defaultValue={extractedData.instructions}
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="手順を1行ずつ入力..."
                    disabled={imagePending}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="image-memo" className="text-sm font-medium">
                    メモ (任意)
                  </label>
                  <textarea
                    id="image-memo"
                    name="memo"
                    defaultValue={extractedData.memo}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="このレシピのメモを入力..."
                    disabled={imagePending}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setExtractedData(null)
                      setSelectedImage(null)
                      setCompressedImageDataUrl(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    disabled={imagePending}
                    className="flex-1"
                  >
                    やり直す
                  </Button>
                  <Button type="submit" disabled={imagePending} className="flex-1">
                    {imagePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登録中...
                      </>
                    ) : (
                      'レシピを登録'
                    )}
                  </Button>
                </div>
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
              <label htmlFor="manual-ingredients" className="text-sm font-medium">
                材料 (任意)
              </label>
              <textarea
                id="manual-ingredients"
                name="ingredients"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="材料を1行ずつ入力..."
                disabled={manualPending}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="manual-instructions" className="text-sm font-medium">
                手順 (任意)
              </label>
              <textarea
                id="manual-instructions"
                name="instructions"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="手順を1行ずつ入力..."
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
