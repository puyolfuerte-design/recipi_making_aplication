'use server'

import ogs from 'open-graph-scraper'
import { z } from 'zod'

// OGPデータの型定義
export type OGPData = {
  title: string
  description?: string
  image?: string
  url: string
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
  }
}

/**
 * URLからOGP情報を取得
 * YouTube URLの場合は oEmbed API を優先使用
 */
export async function fetchOGP(url: string): Promise<OGPData | null> {
  // URLバリデーション
  const validationResult = urlSchema.safeParse(url)
  if (!validationResult.success) {
    return null
  }

  const validatedUrl = validationResult.data

  // YouTube URLは oEmbed API で取得（ボット検出回避）
  const videoId = extractYouTubeVideoId(validatedUrl)
  if (videoId) {
    try {
      const ogpData = await fetchYouTubeOEmbed(validatedUrl)
      if (ogpData) return ogpData
    } catch (error) {
      console.error('YouTube oEmbed取得エラー:', error)
    }
  }

  // YouTube以外 (またはoEmbed失敗時) は open-graph-scraper でフォールバック
  try {
    const { result } = await ogs({
      url: validatedUrl,
      fetchOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    })

    const ogpData: OGPData = {
      title: result.ogTitle || result.dcTitle || 'タイトルなし',
      description: result.ogDescription || result.dcDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: validatedUrl,
    }

    return ogpData
  } catch (error) {
    console.error('OGP取得エラー:', error)
    return null
  }
}
