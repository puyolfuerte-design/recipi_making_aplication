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

// バリデーションスキーマ
const urlSchema = z.object({
  url: z.string().url({ message: '有効なURLを入力してください' }),
})

/**
 * YouTubeモバイル版URLをPC版に変換
 */
function normalizeYouTubeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname === 'm.youtube.com') {
      urlObj.hostname = 'www.youtube.com'
      return urlObj.toString()
    }
    return url
  } catch {
    return url
  }
}

/**
 * URLからOGP情報を取得
 */
export async function fetchOGP(url: string): Promise<OGPData | null> {
  // URLバリデーション
  const validationResult = urlSchema.safeParse({ url })
  if (!validationResult.success) {
    return null
  }

  try {
    // YouTubeモバイルURLをPC版に正規化してからスクレイピング
    const normalizedUrl = normalizeYouTubeUrl(validationResult.data.url)
    const { result } = await ogs({ url: normalizedUrl })

    // OGPデータを抽出
    const ogpData: OGPData = {
      title: result.ogTitle || result.dcTitle || 'タイトルなし',
      description: result.ogDescription || result.dcDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: validationResult.data.url,
    }

    return ogpData
  } catch (error) {
    console.error('OGP取得エラー:', error)
    return null
  }
}
