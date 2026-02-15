'use server'

import ogs from 'open-graph-scraper'
import * as cheerio from 'cheerio'
import { z } from 'zod'
import OpenAI from 'openai'
import { env } from '@/lib/env'

// ============================================================
// 共通型定義
// ============================================================

export type OGPData = {
  title: string
  description?: string
  image?: string
  url: string
  ingredients?: string
  instructions?: string
}

/**
 * YouTube概要欄パース結果の型
 * LLM解析導入時も同じ型を返すように実装してください。
 * 例: export async function extractRecipeWithLLM(text: string): Promise<ParsedDescription>
 */
export type ParsedDescription = {
  ingredients?: string
  instructions?: string
  remainingText?: string
}

// バリデーションスキーマ (Zod v4)
const urlSchema = z.url({ error: '有効なURLを入力してください' })

// ============================================================
// YouTube ユーティリティ
// ============================================================

/**
 * YouTube URLから動画IDを抽出
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

// ============================================================
// YouTube Data API v3 — フェッチ層
// ============================================================

// YouTube Data API v3 レスポンス型
type YouTubeDataResponse = {
  items: Array<{
    snippet: {
      title: string
      description: string
      channelTitle: string
      thumbnails: {
        maxres?: { url: string }
        high?: { url: string }
        medium?: { url: string }
        default?: { url: string }
      }
    }
  }>
}

/**
 * YouTube Data API v3 で動画メタデータ (snippet) を取得する純粋なフェッチ関数。
 * YOUTUBE_API_KEY 未設定時は null を返します。
 * ※ LLM解析を導入する際もこの関数は変更不要です。
 */
async function fetchYouTubeSnippet(videoId: string): Promise<{
  title: string
  description: string
  channelTitle: string
  thumbnailUrl: string
} | null> {
  const apiKey = env.YOUTUBE_API_KEY
  if (!apiKey) return null

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`

  try {
    const res = await fetch(apiUrl)
    if (!res.ok) {
      console.error('YouTube Data API エラー:', res.status, res.statusText)
      return null
    }

    const data = (await res.json()) as YouTubeDataResponse
    const item = data.items?.[0]
    if (!item) {
      console.warn('YouTube Data API: 動画が見つかりません (id:', videoId, ')')
      return null
    }

    const { snippet } = item
    const thumbnailUrl =
      snippet.thumbnails.maxres?.url ??
      snippet.thumbnails.high?.url ??
      snippet.thumbnails.medium?.url ??
      snippet.thumbnails.default?.url ??
      ''

    return {
      title: snippet.title,
      description: snippet.description,
      channelTitle: snippet.channelTitle,
      thumbnailUrl,
    }
  } catch (error) {
    console.error('YouTube Data API 通信エラー:', error)
    return null
  }
}

// ============================================================
// YouTube 概要欄パーサー — パース層
// ============================================================

// セクションマーカーの内部型
type SectionMarker = {
  type: 'ingredients' | 'instructions' | 'end'
  lineIndex: number
}

/**
 * 第2段階: 区切り線（ーーーー）で囲まれたレシピブロックを検出する。
 * 「★今回のレシピはこちら↓」のようなマーカー直後の区切り線ペアの間を
 * 材料（空行前）と手順（空行後）に分割して返す。
 */
function parseSeparatorBasedRecipe(lines: string[]): ParsedDescription {
  const RECIPE_MARKER = /[★☆].*レシピ|レシピはこちら/i
  const SEPARATOR = /^[ーー━─\-=]{4,}$/

  // レシピマーカー行を探す
  let markerIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (RECIPE_MARKER.test(lines[i].trim())) {
      markerIndex = i
      break
    }
  }
  if (markerIndex === -1) return {}

  // マーカー以降の区切り線ペアを探す
  const separators: number[] = []
  for (let i = markerIndex + 1; i < lines.length; i++) {
    if (SEPARATOR.test(lines[i].trim())) {
      separators.push(i)
      if (separators.length >= 2) break
    }
  }
  if (separators.length < 2) return {}

  // 区切り線ペアの間のコンテンツを取得
  const contentLines = lines.slice(separators[0] + 1, separators[1])

  // 空行で区切ってグループ化
  const groups: string[][] = []
  let current: string[] = []
  for (const line of contentLines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        groups.push(current)
        current = []
      }
    } else {
      current.push(line.trim())
    }
  }
  if (current.length > 0) groups.push(current)
  if (groups.length === 0) return {}

  // 最初のグループ → 材料（【タイトル】行も含める）
  const ingredients = groups[0].join('\n')

  // 2番目以降のグループ → 手順
  let instructions: string | undefined
  if (groups.length >= 2) {
    instructions = groups.slice(1).flat().join('\n')
  }

  // マーカー行より前のテキストを remainingText として返す
  const beforeLines = lines
    .slice(0, markerIndex)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const remainingText = beforeLines.length > 0 ? beforeLines.join('\n') : undefined

  return { ingredients, instructions, remainingText }
}

/**
 * YouTube動画の概要欄からレシピ情報（材料・手順）を抽出する
 * ルールベースパーサー。
 *
 * LLM解析への切り替え方:
 *   1. `extractRecipeWithLLM(text: string): Promise<ParsedDescription>` を実装
 *   2. fetchYouTubeData 内の parseYouTubeDescription 呼び出しを置き換えるだけ
 *      (fetchYouTubeSnippet や OGPData へのマッピングは変更不要)
 *
 * exported: テスト・LLMへの差し替えがしやすいよう公開しています
 */
export async function parseYouTubeDescription(description: string): Promise<ParsedDescription> {
  if (!description.trim()) return {}

  const lines = description.split('\n')

  // セクションヘッダーの判定パターン
  const INGREDIENT_HEADER =
    /^[★☆【\[＜<◆■▼●○▶️*\-]?\s*(材料|食材|用意するもの|レシピ|Ingredients?)\s*/i
  const INSTRUCTION_HEADER =
    /^[★☆【\[＜<◆■▼●○▶️*\-]?\s*(作り方|手順|調理方法|調理手順|ステップ|How to|Recipe|Instructions?)\s*/i
  // 概要欄のメタ情報ゾーン（SNSリンク等）の開始を示すパターン
  const END_BOUNDARY =
    /^([ー━─\-=]{3,}|チャンネル登録|Twitter|Instagram|TikTok|公式|SNS|X：|🔔|♪|BGM|使用機材|■(?!材料|食材|作り))/i

  // セクションマーカーを収集
  const markers: SectionMarker[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (INGREDIENT_HEADER.test(line)) {
      markers.push({ type: 'ingredients', lineIndex: i })
    } else if (INSTRUCTION_HEADER.test(line)) {
      markers.push({ type: 'instructions', lineIndex: i })
    } else if (markers.length > 0 && END_BOUNDARY.test(line)) {
      markers.push({ type: 'end', lineIndex: i })
      break
    }
  }

  if (markers.length === 0) {
    // 第2段階: 区切り線ベースのレシピブロック検出
    // 例: ★今回のレシピはこちら↓ → ーーーー → 材料 → 空行 → 手順 → ーーーー
    return parseSeparatorBasedRecipe(lines)
  }

  // マーカー間のテキストブロックを抽出するヘルパー
  const extractBlock = (
    startMarker: SectionMarker,
    nextLineIndex: number
  ): string | undefined => {
    const block = lines
      .slice(startMarker.lineIndex + 1, nextLineIndex)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n')
    return block || undefined
  }

  let ingredients: string | undefined
  let instructions: string | undefined

  markers.forEach((marker, idx) => {
    if (marker.type === 'end') return
    const nextLineIndex =
      idx + 1 < markers.length ? markers[idx + 1].lineIndex : lines.length
    const block = extractBlock(marker, nextLineIndex)
    if (marker.type === 'ingredients') ingredients = block
    if (marker.type === 'instructions') instructions = block
  })

  // セクション開始前のテキストを remainingText として返す
  const firstMarkerLine = markers[0].lineIndex
  const beforeLines = lines
    .slice(0, firstMarkerLine)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const remainingText = beforeLines.length > 0 ? beforeLines.join('\n') : undefined

  return { ingredients, instructions, remainingText }
}

// ============================================================
// YouTube — オーケストレーション層
// ============================================================

/**
 * YouTube oEmbed API でタイトル・サムネイルを取得（フォールバック用）
 */
type YouTubeOEmbedResponse = {
  title: string
  thumbnail_url: string
  author_name: string
}

async function fetchYouTubeOEmbed(url: string): Promise<OGPData | null> {
  const apiUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  try {
    const res = await fetch(apiUrl)
    if (!res.ok) return null
    const data = (await res.json()) as YouTubeOEmbedResponse
    if (!data.title) return null
    return {
      title: data.title,
      description: data.author_name ? `by ${data.author_name}` : undefined,
      image: data.thumbnail_url,
      url,
    }
  } catch (error) {
    console.error('YouTube oEmbed エラー:', error)
    return null
  }
}

/**
 * YouTube URL から OGPData を構築するメインエントリ。
 *
 * フロー:
 *   1. YouTube Data API v3 でメタデータ取得 (fetchYouTubeSnippet)
 *   2. 概要欄をルールベースパーサーで解析 (parseYouTubeDescription)
 *      ★ LLM導入時はここを extractRecipeWithLLM に差し替えるだけ
 *   3. API Key 未設定 or API 失敗時 → oEmbed にフォールバック
 */
async function fetchYouTubeData(
  videoId: string,
  url: string
): Promise<OGPData | null> {
  const snippet = await fetchYouTubeSnippet(videoId)

  if (!snippet) {
    // YOUTUBE_API_KEY 未設定 or API 失敗 → oEmbed フォールバック
    return fetchYouTubeOEmbed(url)
  }

  // YouTube には Recipe JSON-LD が存在しないため、常に LLM で判定する
  const llmResult = snippet.description
    ? await extractRecipeWithLLM(snippet.description.slice(0, 8000))
    : null

  return {
    title: snippet.title,
    description: snippet.description ? snippet.description.slice(0, 200) : undefined,
    image: snippet.thumbnailUrl || undefined,
    url,
    ingredients: llmResult?.ingredients || undefined,
    instructions: llmResult?.instructions || undefined,
  }
}

// ============================================================
// JSON-LD パーサー (非YouTube サイト用)
// ============================================================

type SchemaRecipe = {
  '@type': string
  recipeIngredient?: string[]
  recipeInstructions?:
    | string
    | string[]
    | Array<{ '@type'?: string; text?: string }>
}

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

// ============================================================
// LLM解析 (非YouTube サイト用フォールバック)
// ============================================================

/**
 * LLMのトークン節約のため、HTMLから不要要素を除去してテキストに変換する。
 * script/style/noscript/iframe/svg/header/footer/nav を削除し、
 * ブロック要素の区切りに改行を挿入して圧縮する。
 */
function cleanHtmlForLLM(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, iframe, svg, header, footer, nav').remove()
  $('br').replaceWith('\n')
  $(
    'div, p, li, ul, ol, h1, h2, h3, h4, h5, h6, section, article, blockquote'
  ).each((_, el) => {
    $(el).append('\n')
  })
  return $.root()
    .text()
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .slice(0, 8000) // トークン節約のため上限を設ける
}

/**
 * OpenAI gpt-4o-mini でテキストから材料・手順を抽出する。
 * APIキー未設定・APIエラー時は null を返して処理を継続させる。
 */
async function extractRecipeWithLLM(
  text: string
): Promise<{ ingredients: string; instructions: string } | null> {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'あなたはレシピ情報の抽出専門家です。入力テキストに明示的に記載されている「材料」と「作り方（手順）」のみを抽出し、JSON形式で出力してください。\n\n【厳守事項】\n- テキストに記載されていない情報は絶対に生成・推測・補完しないこと\n- 材料の記載がなければ ingredients は空文字列にすること\n- 手順の記載がなければ instructions は空文字列にすること\n- テキストから読み取れる内容だけを忠実に転記すること\n\n出力形式: { "ingredients": "材料1\\n材料2\\n...", "instructions": "手順1\\n手順2\\n..." }',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content) as {
      ingredients?: string
      instructions?: string
    }
    const ingredients = parsed.ingredients?.trim() || ''
    const instructions = parsed.instructions?.trim() || ''
    if (!ingredients && !instructions) return null

    return { ingredients, instructions }
  } catch (error) {
    console.error('LLM解析エラー:', error)
    return null
  }
}

/**
 * HTML文字列から JSON-LD の Recipe スキーマを解析して材料・手順を返す。
 * ネットワーク処理は行わない（fetchOGP が HTML を渡す）。
 */
function parseRecipeJsonLD(html: string): {
  hasJsonLd: boolean
  ingredients?: string
  instructions?: string
} {
  const recipe = findSchemaRecipe(html)
  if (!recipe) return { hasJsonLd: false }

  const ingredients =
    Array.isArray(recipe.recipeIngredient) && recipe.recipeIngredient.length > 0
      ? recipe.recipeIngredient.join('\n')
      : undefined

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

  return { hasJsonLd: true, ingredients, instructions }
}

// ============================================================
// 公開エントリポイント
// ============================================================

/**
 * URLからOGP情報を取得するメイン関数
 * - YouTube URL → fetchYouTubeData (Data API + パーサー / oEmbed フォールバック)
 * - その他 URL   → open-graph-scraper + JSON-LD抽出 (並行実行)
 */
export async function fetchOGP(url: string): Promise<OGPData | null> {
  const validationResult = urlSchema.safeParse(url)
  if (!validationResult.success) return null

  const validatedUrl = validationResult.data

  const videoId = extractYouTubeVideoId(validatedUrl)
  if (videoId) {
    try {
      return await fetchYouTubeData(videoId, validatedUrl)
    } catch (error) {
      console.error('YouTube取得エラー:', error)
      return null
    }
  }

  // YouTube以外: OGP取得 と HTML取得 を並行実行（HTML は JSON-LD / LLM で共用）
  const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  try {
    const [ogsResult, html] = await Promise.all([
      ogs({
        url: validatedUrl,
        fetchOptions: { headers: { 'User-Agent': USER_AGENT } },
      }),
      fetch(validatedUrl, { headers: { 'User-Agent': USER_AGENT } })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    ])

    const { result } = ogsResult
    const jsonLdResult = parseRecipeJsonLD(html)
    let { ingredients, instructions } = jsonLdResult

    // JSON-LD（Recipe スキーマ）が存在しない場合のみ LLM で判定
    if (!jsonLdResult.hasJsonLd && html) {
      const llmResult = await extractRecipeWithLLM(cleanHtmlForLLM(html))
      if (llmResult) {
        ingredients = llmResult.ingredients || undefined
        instructions = llmResult.instructions || undefined
      }
    }

    return {
      title: result.ogTitle || result.dcTitle || 'タイトルなし',
      description: result.ogDescription || result.dcDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: validatedUrl,
      ingredients,
      instructions,
    }
  } catch (error) {
    console.error('OGP取得エラー:', error)
    return null
  }
}
