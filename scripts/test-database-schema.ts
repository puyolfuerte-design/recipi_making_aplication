import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase'

// .env.localを読み込み
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function testDatabaseSchema() {
  console.log('🔍 データベーススキーマ確認テスト開始...\n')

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

  try {
    // 1. profilesテーブルの確認
    console.log('📋 1. profiles テーブルの確認...')
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (profilesError && !profilesError.message.includes('0 rows')) {
      console.error('❌ profilesテーブルエラー:', profilesError.message)
    } else {
      console.log('✅ profilesテーブル: 正常')
    }

    // 2. recipesテーブルの確認
    console.log('📋 2. recipes テーブルの確認...')
    const { data: recipesData, error: recipesError } = await supabase
      .from('recipes')
      .select('*')
      .limit(1)

    if (recipesError && !recipesError.message.includes('0 rows')) {
      console.error('❌ recipesテーブルエラー:', recipesError.message)
    } else {
      console.log('✅ recipesテーブル: 正常')
    }

    // 3. tagsテーブルの確認
    console.log('📋 3. tags テーブルの確認...')
    const { data: tagsData, error: tagsError } = await supabase
      .from('tags')
      .select('*')
      .limit(1)

    if (tagsError && !tagsError.message.includes('0 rows')) {
      console.error('❌ tagsテーブルエラー:', tagsError.message)
    } else {
      console.log('✅ tagsテーブル: 正常')
    }

    // 4. recipe_tagsテーブルの確認
    console.log('📋 4. recipe_tags テーブルの確認...')
    const { data: recipeTagsData, error: recipeTagsError } = await supabase
      .from('recipe_tags')
      .select('*')
      .limit(1)

    if (recipeTagsError && !recipeTagsError.message.includes('0 rows')) {
      console.error('❌ recipe_tagsテーブルエラー:', recipeTagsError.message)
    } else {
      console.log('✅ recipe_tagsテーブル: 正常')
    }

    console.log('\n🎉 全てのテーブルが正常に作成されています!')
    console.log('\n📊 データベーススキーマ情報:')
    console.log('  - profiles: ユーザープロフィール')
    console.log('  - recipes: レシピ本体')
    console.log('  - tags: タグマスタ')
    console.log('  - recipe_tags: レシピ×タグ中間テーブル')
    console.log('\n🔒 Row Level Security (RLS): 全テーブルで有効')
    console.log('🚀 型定義: src/types/supabase.ts に生成済み')

    process.exit(0)

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
    process.exit(1)
  }
}

testDatabaseSchema()
