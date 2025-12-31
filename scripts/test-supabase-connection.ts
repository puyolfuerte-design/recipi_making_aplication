import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// .env.localを読み込み
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function testConnection() {
  console.log('🔍 Supabase接続テスト開始...\n')

  console.log(`URL: ${supabaseUrl}`)
  console.log(`Anon Key: ${supabaseAnonKey.substring(0, 20)}...\n`)

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // 接続テスト: auth.getSessionを実行
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ 接続エラー:', error.message)
      process.exit(1)
    }

    console.log('✅ Supabase接続成功!')
    console.log('📊 セッション情報:', data.session ? 'ログイン済み' : '未ログイン')

    // ヘルスチェック
    const { error: healthError } = await supabase
      .from('_metadata')
      .select('*')
      .limit(1)

    // テーブルが存在しなくてもOK（接続できていればOK）
    if (healthError && !healthError.message.includes('does not exist')) {
      console.warn('⚠️  ヘルスチェック警告:', healthError.message)
    } else {
      console.log('✅ データベース疎通確認完了\n')
    }

    console.log('🎉 全ての接続テストが正常に完了しました!')
    process.exit(0)

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
    process.exit(1)
  }
}

testConnection()
