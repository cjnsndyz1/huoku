// api/coach.js — Vercel Serverless Function
// 货库系统的「AI 造货教练」后端代理。
// 职责：接收三行内容，按模式调用 DeepSeek，返回追问或套话检测结果。
// 安全：DEEPSEEK_API_KEY 存于 Vercel 环境变量，前端代码零 Key。

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

// ── 教练式提示词 ──
// 核心原则：只追问、只给方向，绝不替用户思考、绝不代答。
// 因为「货库」治的是「没货」——一旦 AI 代答，用户就练不到「自己想」。

const DIG_SYSTEM = `你是「货库」的表达训练教练。用户正在做一件事：把当天一件真实小事，挖成一句属于自己的判断。

用户已经写了「发生了什么」，但卡在「我怎么想」写不下去。

你的任务：基于他写的内容，追问一个具体的「为什么」，帮他往下挖一层。

硬性要求：
1. 只输出一个追问，25 字以内，必须是问句
2. 追问必须具体——针对他写的那件具体的事，禁止泛泛的「你为什么这么想」「你当时什么感受」
3. 绝不替他回答，绝不给出你的判断、观点或「更好的说法」
4. 如果他写的「发生了什么」本身很空洞（没有具体的人、事、细节），先追问让他补充细节
5. 只输出追问本身，不加任何前缀、解释、引号`

const CLICHE_SYSTEM = `你是「货库」的表达训练教练。用户刚写了「一句话判断」——即他对某件事自己的看法。

你的任务：判断这句话是他自己的具体判断，还是「套话」（别人说烂的、没有他个人视角的通用道理）。

判断标准：
- 套话特征：名言警句、鸡汤（如「坚持就是胜利」「一日之计在于晨」）、正确的废话、没有具体内容
- 自己的判断特征：有具体对象、有个人视角、能看出是他真实经历得出的

输出要求：
1. 只输出一句话反馈，30 字以内
2. 如果是套话 → 直接指出并追问：「这是套话，你对这件事的具体判断是什么？」
3. 如果确实是自己的判断 → 简短肯定一句（如「有你的视角」），不啰嗦
4. 不加任何前缀、解释、引号`

export default async function handler(req, res) {
  // CORS（允许前端跨域调用）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' })
    return
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    res.status(500).json({ ok: false, error: 'DEEPSEEK_API_KEY 未配置' })
    return
  }

  const body = req.body || {}
  const { mode, happened, thought, judgment } = body

  let system
  let user
  if (mode === 'dig') {
    system = DIG_SYSTEM
    user = `发生了什么：${happened || ''}\n已经写的「我怎么想」：${thought || '（还没写）'}`
  } else if (mode === 'cliche') {
    system = CLICHE_SYSTEM
    user = `一句话判断：${judgment || ''}`
  } else {
    res.status(400).json({ ok: false, error: 'mode 必须是 dig 或 cliche' })
    return
  }

  try {
    const resp = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      res.status(502).json({ ok: false, error: `DeepSeek 调用失败: ${err.slice(0, 200)}` })
      return
    }

    const data = await resp.json()
    const content = (data.choices?.[0]?.message?.content || '').trim()
    const result = mode === 'dig' ? { ok: true, question: content } : { ok: true, feedback: content }
    res.status(200).json(result)
  } catch (e) {
    res.status(502).json({ ok: false, error: `调用异常: ${e.message}` })
  }
}
