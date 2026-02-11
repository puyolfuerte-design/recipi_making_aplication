'use server'

import ogs from 'open-graph-scraper'
import * as cheerio from 'cheerio'
import { z } from 'zod'

// OGPデータの型定義
export type OGPData = {
  title: string
  description?: string
  image?: string
  url: string
  ingredients?: string
  instructions?: string
}

// バリデーションスキーマ (Zod v4: z.url() を使用)
const urlSchema = z.url({ error: '有効なURLを入力してください' })

/**
 * YouTubeのURLかどうかを判定し、動画IDを返す
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace('m.', '')

    if (hostname === 'www.youtube.com' || hostname === 'youtube.com') {
      return urlObj.searchParams.get('v')
    }
    if (hostname === 'youtu.be') {
      return urlObj.pathname.slice(1) || null
    }
    return null
  } catch {
    return null
  }
}

// YouTube oEmbed APIのレスポンス型
type YouTubeOEmbedResponse = {
  title: string
  thumbnail_url: string
  author_name: string
}

/**
 * YouTube oEmbed APIでタイトル・サムネイルを取得
 */
async function fetchYouTubeOEmbed(url: string): Promise<OGPData | null> {
  const apiUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`

  const res = await fetch(apiUrl)
  if (!res.ok) return null

  const data = (await res.json()) as YouTubeOEmbedResponse
  if (!data.title) return null

  return {
    title: data.title,
    description: data.author_name ? `by ${data.author_name}` : undefined,
    image: data.thumbnail_url,
    url,
    // YouTube は JSON-LD からレシピ情報を取得できないため空欄
  }
}

// JSON-LD の schema.org/Recipe 型
type SchemaRecipe = {
  '@type': string
  recipeIngredient?: string[]
  recipeInstructions?:
    | string
    | string[]
    | Array<{ '@type'?: string; text?: string }>
}

/**
 * JSON-LD の単一ノードから Recipe を再帰的に探す純粋関数
 * (closure内でのlet変更を避けTypeScriptの型推論を正確に保つ)
 */
function extractRecipeFromLd(raw: unknown): SchemaRecipe | null {
  if (raw === null || typeof raw !== 'object') return null

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = extractRecipeFromLd(item)
      if (found) return found
    }
    return null
  }

  if ('@type' in raw && (raw as SchemaRecipe)['@type'] === 'Recipe') {
    return raw as SchemaRecipe
  }

  if ('@graph' in raw) {
    const graph = (raw as { '@graph': unknown })['@graph']
    if (Array.isArray(graph)) {
      for (const node of graph) {
        const found = extractRecipeFromLd(node)
        if (found) return found
      }
    }
  }

  return null
}

/**
 * HTML文字列から schema.org/Recipe の JSON-LD を検索して返す
 */
function findSchemaRecipe(html: string): SchemaRecipe | null {
  const $ = cheerio.load(html)
  const scripts = $('script[type="application/ld+json"]').toArray()

  for (const el of scripts) {
    try {
      const raw: unknown = JSON.parse($(el).text())
      const found = extractRecipeFromLd(raw)
      if (found) return found
    } catch {
      // JSON.parse失敗は無視
    }
  }
  return null
}

/**
 * HTMLからJSON-LD (schema.org/Recipe) を抽出し、材料・手順を返す
 */
async function fetchRecipeJsonLD(
  url: string
): Promise<{ ingredients?: string; instructions?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) return {}

    const html = await res.text()
    const recipe = findSchemaRecipe(html)
    if (!recipe) return {}

    // recipeIngredient: string[] → 改行区切り文字列
    const ingredients =
      Array.isArray(recipe.recipeIngredient) &&
      recipe.recipeIngredient.length > 0
        ? recipe.recipeIngredient.join('\n')
        : undefined

    // recipeInstructions: string / string[] / HowToStep[] の3形式に対応
    let instructions: string | undefined
    if (recipe.recipeInstructions) {
      const raw = recipe.recipeInstructions
      if (typeof raw === 'string') {
        instructions = raw
      } else if (Array.isArray(raw)) {
        const lines = raw
          .map((step) => {
            if (typeof step === 'string') return step
            if (typeof step === 'object' && step !== null && 'text' in step) {
              return step.text ?? ''
            }
            return ''
          })
          .filter((s) => s.length > 0)
        instructions = lines.length > 0 ? lines.join('\n') : undefined
      }
    }

    return { ingredients, instructions }
  } catch (error) {
    console.error('JSON-LD取得エラー:', error)
    return {}
  }
}

/**
 * URLからOGP情報を取得
 * YouTube URLの場合は oEmbed API を優先使用
 * YouTube以外は open-graph-scraper + JSON-LD抽出を並行実行
 */
export async function fetchOGP(url: string): Promise<OGPData | null> {
  // URLバリデーション
  const validationResult = urlSchema.safeParse(url)
  if (!validationResult.success) {
    return null
  }

  const validatedUrl = validationResult.data

  // YouTube URLは oEmbed API で取得（ボット検出回避、JSON-LDスキップ）
  const videoId = extractYouTubeVideoId(validatedUrl)
  if (videoId) {
    try {
      const ogpData = await fetchYouTubeOEmbed(validatedUrl)
      if (ogpData) return ogpData
    } catch (error) {
      console.error('YouTube oEmbed取得エラー:', error)
    }
  }

  // YouTube以外: OGP取得 と JSON-LD抽出 を並行実行
  try {
    const [ogsResult, jsonLdResult] = await Promise.all([
      ogs({
        url: validatedUrl,
        fetchOptions: {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
      }),
      fetchRecipeJsonLD(validatedUrl),
    ])

    const { result } = ogsResult

    const ogpData: OGPData = {
      title: result.ogTitle || result.dcTitle || 'タイトルなし',
      description: result.ogDescription || result.dcDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: validatedUrl,
      ingredients: jsonLdResult.ingredients,
      instructions: jsonLdResult.instructions,
    }

    return ogpData
  } catch (error) {
    console.error('OGP取得エラー:', error)
    return null
  }
}
