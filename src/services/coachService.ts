// AI 教练调用封装
// 部署后走 /api/coach（Vercel 同域名）；本地开发时该路由不存在，会抛错由页面降级提示。

export type CoachMode = 'dig' | 'cliche'

export interface CoachPayload {
  happened?: string
  thought?: string
  judgment?: string
}

export async function callCoach(mode: CoachMode, payload: CoachPayload): Promise<string> {
  const resp = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, ...payload }),
  })

  if (!resp.ok) {
    throw new Error(`服务异常（${resp.status}）`)
  }

  const data = await resp.json()
  if (!data.ok) {
    throw new Error(data.error || '调用失败')
  }

  return mode === 'dig' ? data.question : data.feedback
}
