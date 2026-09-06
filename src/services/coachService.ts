// AI 教练调用（费曼式：前端直连，key 存浏览器 localStorage 缓存）
// 产品里没有"公共 key"，每个使用者花各自的额度，天然隔离。
// key 同时存 Supabase（按账号同步），换设备登录后自动带过来。

import { loadAiSettings } from './aiSettingsService'

export type CoachMode = 'dig' | 'cliche'

export interface CoachPayload {
  happened?: string
  thought?: string
  judgment?: string
  /** 上次 AI 追问过的问题，dig 模式用它防止重复提问 */
  lastQuestion?: string
}

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

// ── 出货（P3）相关类型 ──

/** 出货练习里的一轮对话 */
export interface ShipMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 出货场景：AI 扮演的听众 + 场景设定 */
export interface ShipScenario {
  id: string
  name: string
  role: string
  setting: string
}

export const SHIP_SCENARIOS: ShipScenario[] = [
  { id: 'report', name: '向领导汇报', role: '领导', setting: '你在向领导汇报工作，领导关心进展，想知道结果、以及需要什么支持' },
  { id: 'chat', name: '跟朋友闲聊', role: '朋友', setting: '你跟朋友吃饭聊天，很放松，自然提起这件事' },
  { id: 'dinner', name: '饭桌即兴', role: '饭桌上的熟人', setting: '饭局上有人提起相关话题，大家七嘴八舌，你想插一句自己的看法' },
  { id: 'convince', name: '说服别人', role: '持不同意见的人', setting: '对方不太认同你的判断，甚至有点反驳，你想让他理解你的角度' },
]

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
6. 如果「发生了什么」是空的（还没写），先帮他想起今天的事——问「今天有没有哪一刻让你停下来过？哪怕一秒」这类引导回忆的问题，不要替他选事
7. 即使「我怎么想」已经写了内容，也必须追问一个更深的角度——你的存在就是为了帮用户挖到他自己真正想说的话，不要因为"他已经写了"就跳过
8. 如果用户提供了「上次问过的问题」，这次绝不能重复它，必须换一个角度
9. 只输出追问本身，不加任何前缀、解释、引号

示例（反例→正例）：
用户写「今天上班很累」
×「你为什么觉得累？」（太泛）
√「今天哪件事最让你想下班？」（具体到事）

用户写「跟同事吵了一架，他说我太计较」
×「你为什么计较？」（替用户预设了立场）
√「他说那句话时你第一反应是什么？」（挖感受，不预设）`

const CLICHE_SYSTEM = `你是「货库」的表达训练教练。用户刚写了「一句话判断」——即他对某件事自己的看法。

你的任务：判断这句话是他自己的具体判断，还是「套话」。你只能判定 + 追问，绝不能替他改写、不能给句式、不能示范"更好的说法"——那是他自己的活，你代劳了就等于让他抄作业。

判断标准（同时满足才算"自己的判断"，缺任一就是套话）：
- 有具体对象（点名了某件具体事/某个人/某个场景，不是泛指）
- 有个人视角（能看出是他自己经历得出的，不是别人说烂的道理）

四类套话（命中任一即判套话）：
- 鸡汤：名言警句、励志金句（如「坚持就是胜利」「一日之计在于晨」）
- 正确的废话：放之四海皆准，无信息量（如「这件事让我更成熟」「要学会放下」）
- 别人说过的观点：他人观点的复述（如「细节决定成败」「选择比努力重要」）
- 无主语感想：没有主语的泛泛感叹（如「生活就是这样」「人心难测」）

输出要求：
1. 只输出一句话，45 字以内，形式是「判定 + 追问」
2. 是套话 → 点名哪一类（「这是鸡汤/废话/他人观点/泛泛感想」）+ 追问「今天这件具体的事，你自己到底怎么看？」——绝不给改写、绝不给句式、绝不替他把判断说出来
3. 是自己的判断 → 简短肯定一句（如「有你的视角」），不啰嗦
4. 不加任何前缀、解释、引号

示例：
判断「细节决定成败」
√「这是别人说过的观点。今天这件事，你自己到底怎么看？」

判断「老王今天迟到是因为他昨晚又喝多了，他这人就是管不住自己」
√「有你的视角——但"管不住自己"是观察，还是标签？」`

const SHIP_SYSTEM = `你是「货库」的出货教练。用户正在练「把一条货说出口」——他手上有一条货（一件具体的事 + 他自己的判断），现在要在一个真实场景里，用嘴把它说出来（用户用打字代替说话）。

你要扮演这个场景里的【听众】，不是老师、不是写手、不是评委。

你要做的事：
1. 第一轮（你第一次开口）：以听众身份，抛一个这个场景下最自然的开场，把话头递给他。比如向领导汇报的场景，你开场「对了，上次那个项目你盯得怎么样了？」——像真实对话一样自然。
2. 之后每一轮，用户说完一段，你只从下面三件事里挑一件最合适的做：
   - 追问：他说得含糊的地方，顺着问清（「你说的『信息边界』，具体是哪条信息没拿到？」）
   - 复述：他绕了，你就用你的话复述一遍，跟他确认（「你的意思是……对吗？」）
   - 点结构：他缺了结论，就点一句（「你说了过程，那你想让我做什么？」）

铁律（绝不能破）：
- 绝不替他把话说完，绝不给他一句「你可以这样说」的完整示范
- 绝不评价他说得好不好、绝不打分、绝不表扬式点评
- 始终以听众身份接话，像真人对话，不要变成「教练点评」
- 每次只回一句话，60 字以内`

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

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function buildMessages(mode: CoachMode, payload: CoachPayload) {
  let system: string
  let user: string
  if (mode === 'dig') {
    system = DIG_SYSTEM
    user = `发生了什么：${payload.happened?.trim() || '（还没写）'}\n已经写的「我怎么想」：${payload.thought?.trim() || '（还没写）'}`
    const last = payload.lastQuestion?.trim()
    if (last) user += `\n\n你上次问的是：「${last}」——这次绝不能重复，换一个更深的角度。`
    user += `\n\n请基于以上所有内容追问一个更深的角度。`
  } else {
    system = CLICHE_SYSTEM
    user = `一句话判断：${payload.judgment?.trim() || ''}`
  }
  return {
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ],
    temperature: mode === 'dig' ? 0.7 : 0.5,
    maxLen: mode === 'dig' ? 40 : 60,
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
      cache: 'no-store',
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
function cleanCoachReply(raw: string, maxLen = 40): string {
  let s = raw.trim()
  // 剥离常见前缀（追问：/问题：/AI：/教练：/答：等）
  s = s.replace(/^(追问|问题|AI|教练|答|回复|问)[:：]\s*/i, '')
  // 剥离开头/结尾引号
  s = s.replace(/^["「『"'"""\s]+/, '').replace(/["」』"'"""\s]+$/, '')
  // 超长截到第一个问号或句号
  if (s.length > maxLen) {
    const m = s.slice(0, maxLen).match(/^[^。？?！!]+[。？?！!]/)
    if (m) s = m[0]
  }
  return s.trim()
}

/** 加载 API 配置：本地 → 云端兜底（跨设备场景，登录后自动带上） */
async function resolveConfig(): Promise<ApiConfig> {
  let config = loadApiConfig()
  if (!config.apiKey.trim()) {
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
  return config
}

/** 通用：发 messages 请求 + 重试 + 后处理 */
async function chat(messages: ChatMessage[], config: ApiConfig, temperature: number, maxLen: number): Promise<string> {
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const body = {
    model: config.model.trim(),
    messages,
    // V4-Flash 默认开 thinking + effort=high，会吃光 max_tokens 预算导致 content 为空。
    // dig/cliche/ship 都是简单任务，不需要思考链；关掉 thinking 让 temperature 重新生效。
    thinking: { type: 'disabled' },
    max_tokens: 1024,
    temperature,
  }
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
    if (content) return cleanCoachReply(content, maxLen)
    // 空内容：重试
    if (attempt >= MAX_RETRIES) break
    await sleep(300 * (attempt + 1))
  }
  throw new Error('AI 返回为空，请稍后再试')
}

export async function callCoach(mode: CoachMode, payload: CoachPayload): Promise<string> {
  const config = await resolveConfig()
  const { messages, temperature, maxLen } = buildMessages(mode, payload)
  return chat(messages, config, temperature, maxLen)
}

/** 出货练习（P3）：AI 扮听众，多轮对话，只追问/复述/点结构，绝不代写 */
export async function shipCoach(input: {
  entry: { happened: string; thought: string; judgment: string }
  scenario: ShipScenario
  history: ShipMessage[]
}): Promise<string> {
  const config = await resolveConfig()
  const e = input.entry
  const context = [
    `【场景】${input.scenario.name}，听众是「${input.scenario.role}」。${input.scenario.setting}`,
    ``,
    `【我的货】`,
    `发生了什么：${e.happened || '（无）'}`,
    `我怎么想：${e.thought || '（无）'}`,
    `一句话判断：${e.judgment || '（无）'}`,
    ``,
    input.history.length === 0 ? '请以听众身份，用一句自然的开场把话头递给我。' : '继续这场对话。',
  ].join('\n')
  const messages: ChatMessage[] = [
    { role: 'system', content: SHIP_SYSTEM },
    { role: 'user', content: context },
    ...input.history.map((h) => ({ role: h.role, content: h.content })),
  ]
  return chat(messages, config, 0.7, 60)
}

/** 测试连接：发一条最小请求验证配置是否可用 */
export async function testApiConfig(config: ApiConfig): Promise<string> {
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  if (!base) return '请填写 Base URL'
  if (!config.apiKey.trim()) return '请填写 API Key'
  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      cache: 'no-store',
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
