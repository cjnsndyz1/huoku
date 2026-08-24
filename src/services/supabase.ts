// Supabase 客户端 + 认证
// 连接信息（URL + Anon Key）是公开信息，直接写死，换设备无需重新配置。
// 数据安全由 RLS（行级安全）保证，不依赖 key 保密。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://redoplzkztianfbdvcve.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_WM2CzGPvDm-NDQK5VqU55g_0gGhThif'

let client: SupabaseClient | null = null

export function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}

// ── 认证 ──

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string): Promise<void> {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) throw error
  if (!data.session) {
    throw new Error('注册成功，请查收邮箱完成验证后，再回到这里登录')
  }
}

export async function signOut(): Promise<void> {
  await getClient().auth.signOut()
}

export async function isLoggedIn(): Promise<boolean> {
  const { data } = await getClient().auth.getSession()
  return !!data.session
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await getClient().auth.getUser()
  return data.user?.id ?? null
}
