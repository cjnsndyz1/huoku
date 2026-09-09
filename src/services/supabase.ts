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

/** 注册结果：confirmed=已自动登录；verify-email=需先验证邮箱（取决于项目邮箱确认开关） */
export type SignUpResult = 'confirmed' | 'verify-email'

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) throw error
  // 开了邮箱验证时 data.session 为空——这不是失败，是「注册成功、待验证」
  return data.session ? 'confirmed' : 'verify-email'
}

/** 把 Supabase 认证错误翻译成用户看得懂的中文；认不出的错误回退原文 */
export function authErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  if (/invalid login credentials/i.test(msg)) return '邮箱或密码不对，请检查后重试'
  if (/email not confirmed/i.test(msg)) return '邮箱还没验证：请查收验证邮件并点开链接，再回来登录'
  if (/already registered/i.test(msg)) return '这个邮箱已注册过，直接登录即可'
  if (/at least \d+ characters/i.test(msg)) return '密码太短，至少需要 6 位'
  if (/invalid format|invalid email|not a valid email/i.test(msg)) return '邮箱格式不对，请检查后重试'
  if (/rate limit|too many requests/i.test(msg)) return '操作太频繁，请稍等一分钟再试'
  if (/network|fetch|load failed/i.test(msg)) return '连不上服务器，请检查网络后重试'
  return msg || '操作失败，请稍后再试'
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
