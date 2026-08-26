// AI 教练调用（费曼式：前端直连，key 存浏览器 localStorage 缓存）
// 产品里没有"公共 key"，每个使用者花各自的额度，天然隔离。
// key 同时存 Supabase（按账号同步），换设备登录后自动带过来。

import { loadAiSettings } from './aiSettingsService'

export type CoachMode = 'dig' | 'cliche'

export interface CoachPayload {
  happened?: string
  thought?: string
  judgment?: string
}

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

const CONFIG_KEY = 'biaodaxunlian:api-config'

export const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-v4-flash',
}

// ── 教练式提示词 ──
// 核心原则：只追问、只给方向，绝不替用户思考、绝不代答。

const DIG_SYSTEM = `你是「货库」的表达训练教练。用户正在做一件事：把当天一件真实小事，挖成一句属于自己的判断。

你的任务：基于用户写的所有内容（「发生了什么」和「我怎么想」），追问一个问题，帮他把判断挖得更深。追问可以从任一角度切入——细节、感受、对比、因果、矛盾、动机——挑当下最该挖的那个，不要每次都问"为什么"。

硬性要求：
1. 只输出一个追问，25 字以内，必须是问句
2. 追问必须针对他写的具体内容，禁止泛泛的「你为什么这么想」「你当时什么感受」
3. 绝不替他回答，绝不给出你的判断、观点或"更好的说法"
4. 不要复述用户原话开头（如"你说你今天去菜市场了…"），直接抛问
5. 如果「发生了什么」缺具体细节（没有具体的人、动作、对话、场景），优先追问让他补一个具体细节
6. 即使「我怎么想」已经写了内容，也必须追问一个更深的角度——你的存在就是为了帮用户挖到他自己真正想说的话，不要因为"他已经写了"就跳过
7. 只输出追问本身，不加任何前缀、解释、引号

示例（反例→正例）：
用户写「今天上班很累」
×「你为什么觉得累？」（太泛）
√「今天哪件事最让你想下班？」（具体到事）

用户写「跟同事吵了一架，他说我太计较」
×「你为什么计较？」（替用户预设了立场）
√「他说那句话时你第一反应是什么？」（挖感受，不预设）`

const CLICHE_SYSTEM = `你是「货库」的表达训练教练。用户刚写了「一句话判断」——即他对某件事自己的看法。

你的任务：判断这句话是他自己的具体判断，还是「套话」。

判断标准（同时满足才算"自己的判断"，缺任一就是套话）：
- 有具体对象（点名了某件具体事/某个人/某个场景，不是泛指）
- 有个人视角（能看出是他自己经历得出的，不是别人说烂的道理）

四类套话（命中任一即判套话）：
- 鸡汤：名言警句、励志金句（如「坚持就是胜利」「一日之计在于晨」）
- 正确的废话：放之四海皆准，无信息量（如「这件事让我更成熟」「要学会放下」）
- 别人说过的观点：他人观点的复述（如「细节决定成败」「选择比努力重要」）
- 无主语感想：没有主语的泛泛感叹（如「生活就是这样」「人心难测」）

输出要求：
1. 只输出一句话反馈，30 字以内
2. 是套话 → 直接点名哪一类 + 追问：「这是[鸡汤/废话/他人观点/泛泛感想]，你对这件具体事怎么看？」
3. 是自己的判断 → 简短肯定一句（如"有你的视角"），不啰嗦
4. 不加任何前缀、解释、引号

示例：
判断「细节决定成败」
√「这是别人说过的观点，你对今天那件事的具体判断是什么？」

判断「老王今天迟到是因为他昨晚又喝多了，他这人就是管不住自己」
√「有你的视角，但'管不住自己'是判断还是标签？」`

export function loadApiConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    /* 解析失败用默认值 */
  }
  return DEFAULT_CONFIG
}

export function saveApiConfig(config: ApiConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* 静默降级 */
  }
}

export function hasApiKey(): boolean {
  return loadApiConfig().apiKey.trim() !== ''
}

function buildRequest(mode: CoachMode, payload: CoachPayload, config: ApiConfig) {
  let system: string
  let user: string
  if (mode === 'dig') {
    system = DIG_SYSTEM
    user = `发生了什么：${payload.happened || ''}\n已经写的「我怎么想」：${payload.thought || '（还没写）'}\n\n请基于以上所有内容追问一个更深的角度。`
  } else {
    system = CLICHE_SYSTEM
    user = `一句话判断：${payload.judgment || ''}`
  }
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  return {
    url: `${base}/chat/completions`,
    body: {
      model: config.model.trim(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // V4-Flash 默认开 thinking + effort=high，会吃光 max_tokens 预算导致 content 为空。
      // dig/cliche 是简单任务，不需要思考链；关掉 thinking 让 temperature 重新生效。
      thinking: { type: 'disabled' },
      max_tokens: 1024,
      temperature: 0.3,
    },
  }
}

const REQUEST_TIMEOUT_MS = 60_000
const MAX_RETRIES = 2
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 发一次请求，返回解析出的文本；空内容返回 ''（由调用方决定是否重试） */
async function requestOnce(url: string, body: object, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!resp.ok) {
      const err = await resp.text().catch(() => '')
      if (resp.status === 401 || resp.status === 403) throw new Error('API Key 无效，请检查')
      throw new Error(`调用失败（${resp.status}）${err.slice(0, 80)}`)
    }
    const data = await resp.json()
    const msg = data.choices?.[0]?.message || {}
    // 只取 content（最终答案）。reasoning_content 是模型内部思考碎片，不该给用户看。
    return (msg.content || '').trim()
  } finally {
    clearTimeout(timer)
  }
}

/** 后处理：剥离常见前缀 + 截断超长输出，确保追问/反馈干净简短。
 *  AI 不听话是常态，代码兜底比 prompt 强约束更可靠。 */
function cleanCoachReply(raw: string): string {
  let s = raw.trim()
  // 剥离常见前缀（追问：/问题：/AI：/教练：/答：等）
  s = s.replace(/^(追问|问题|AI|教练|答|回复|问)[:：]\s*/i, '')
  // 剥离开头/结尾引号
  s = s.replace(/^["「『"'"""\s]+/, '').replace(/["」』"'"""\s]+$/, '')
  // 超长（>40 字符）截到第一个问号或句号
  if (s.length > 40) {
    const m = s.slice(0, 40).match(/^[^。？?！!]+[。？?！!]/)
    if (m) s = m[0]
  }
  return s.trim()
}

export async function callCoach(mode: CoachMode, payload: CoachPayload): Promise<string> {
  let config = loadApiConfig()
  if (!config.apiKey.trim()) {
    // 本地无 key：尝试从云端同步（跨设备场景，登录后自动带上）
    try {
      const cloud = await loadAiSettings()
      if (cloud && cloud.apiKey.trim()) {
        config = cloud
        saveApiConfig(cloud) // 缓存到本地，下次直接读
      }
    } catch {
      /* 云端读取失败，走下面的报错 */
    }
  }
  if (!config.apiKey.trim()) {
    throw new Error('还没配置 API Key，请先到设置里填写')
  }
  const { url, body } = buildRequest(mode, payload, config)
  const apiKey = config.apiKey.trim()

  for (let attempt = 0; ; attempt++) {
    let content = ''
    try {
      content = await requestOnce(url, body, apiKey)
    } catch (e) {
      // 认证错误重试无意义，直接抛；其余（超时/5xx/网络）重试
      if (e instanceof Error && e.message.startsWith('API Key')) throw e
      if (attempt >= MAX_RETRIES) throw e
      await sleep(300 * (attempt + 1))
      continue
    }
    if (content) return cleanCoachReply(content)
    // 空内容：重试
    if (attempt >= MAX_RETRIES) break
    await sleep(300 * (attempt + 1))
  }
  throw new Error('AI 返回为空，请稍后再试')
}

/** 测试连接：发一条最小请求验证配置是否可用 */
export async function testApiConfig(config: ApiConfig): Promise<string> {
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  if (!base) return '请填写 Base URL'
  if (!config.apiKey.trim()) return '请填写 API Key'
  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [{ role: 'user', content: '回复：OK' }],
        max_tokens: 5,
      }),
    })
    if (resp.ok) return '连接成功'
    if (resp.status === 401 || resp.status === 403) return 'API Key 无效'
    return `连接失败（${resp.status}）`
  } catch {
    return '网络错误，请检查 Base URL'
  }
}
