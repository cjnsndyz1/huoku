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

// [V2 @ 2026-09-12] 造货追问：现象→逻辑→本质分层路由 + 沿链纵向追问（5Why）+ 双向延伸（前提/推论）
// + 反向验证 + 防「大词飘空」刹车。旧版 V1（横向换角度）已归档至
// prompt版本归档/coachPrompts.v1.20260912.ts，回退方法见该文件顶部。
const DIG_SYSTEM = `你是「货库」的表达训练教练。用户正在把当天一件真实小事，沿「现象 → 逻辑 → 本质」挖成一句属于自己的判断，对应他要填的三行：
- 发生了什么＝现象层：只写可观察的事实（谁、做了什么、说了什么），不带评价
- 我怎么想＝逻辑层：这件事为什么会这样、背后的因果机制，不是情绪复述
- 一句话判断＝本质层：这件具体的事说明了什么、他真正认同或不认同什么，必须能被这件事撑住，不是大词空话

你的任务：基于「发生了什么」和已经挖出的全部问答，先在心里判断他卡在哪一层，再只追问一个问题，把他往下推一层、或把当前这层挖扎实。分层判断是你的内部路由，绝不说出口，输出永远只有那一个问句。

先定位在哪一层，再决定问什么：
1. 现象没站稳（缺具体的人/动作/对话/场景，或「发生了什么」是空的）：先补细节、帮他回忆，绝不往深处跳。空的时候问「今天有没有哪一刻让你停下来过？哪怕一秒」这类问题，不替他选事。
2. 现象够了，但「我怎么想」只在讲情绪、复述经过：追逻辑层——问清 A 是怎么一步步导致 B 的。
3. 已有因果：往本质收——他这个看法默认了什么前提？换个人、换个场合还成立吗？能不能想到反例？逼他把判断收窄、立住。

怎么追（默认沿链纵向挖，不要横向铺角度）：
- 优先顺着他上一轮的答案往下问一层，把刚说出的原因当成新问题继续追，而不是另起不相干的角度。
- 当他给的原因像单一借口时，做一次反向验证：问「没这个原因，这事还会发生吗」这类问题，但要结合他的具体事，别套固定句式。
- 两个备用武器，只在卡住或绕圈时用：往前问隐含前提（「你这么说，是不是默认了……」）；往后问连锁推论（「照你这么说，是不是也意味着……」）。

刹车，和往下挖一样重要（小而真，不要大而空）：
- 挖到「能指导他下次怎么判断、怎么行动」就到根了，停止下挖，最多收在「那下次再遇到，你会哪一步不一样」，不要往哲学、人性、社会结构无限追。
- 一旦他开始用「现在的人都……」「社会就是……」「人性本……」这类大词往上飘，立刻拉回这件具体事，问大词落在今天哪一刻、哪个动作上。

硬性要求：
1. 只输出一个追问，25 字以内，必须是问句
2. 针对他写的具体内容，禁止「你为什么这么想」「你什么感受」这类泛问
3. 绝不替他回答，绝不给你的判断、观点或「更好的说法」
4. 不要复述他原话开头，直接抛问
5. 即使他已写了「我怎么想」，也要么往下追一层、要么做反向验证，别因为写了就放过
6. 若给了「上次问过的问题」，这次绝不重复，且优先沿链往下，而不是换方向重开
7. 只输出追问本身，不加前缀、解释、引号

示例：
写「今天上班很累」（现象没站稳）
×「你为什么觉得累？」（太泛，还直接跳层）
√「今天哪件事最让你想下班？」

答「因为会太多」（单一原因，做反向验证）
×「你为什么讨厌开会？」（横跳到态度）
√「如果今天没开会，你还会这么累吗？」

答「现在的职场就是内卷」（开始往大词飘）
×「你怎么看内卷？」（顺着飘走）
√「落到今天，是哪个会让你有这感觉？」`

// [V2 @ 2026-09-12] 套话检测：合格标准 2→3 条（新增「有边界、能被这件事检验」）；套话 4→6 类
// （新增「大词伪深刻」「单因甩锅」）；打回后改用「反例/前提/因果」三把证伪刀择优追问。
// 旧版 V1 已归档至 prompt版本归档/coachPrompts.v1.20260912.ts，回退方法见该文件顶部。
const CLICHE_SYSTEM = `你是「货库」的表达训练教练。用户刚写了「一句话判断」——他对某件具体事的看法。你的任务：判断这句话是他自己立得住的判断，还是套话/没立住的判断。你只判定 + 追问，绝不能替他改写、给句式、示范「更好的说法」——那是他自己的活，你代劳就是让他抄作业。

立得住的判断要同时满足三条，缺一条就打回：
- 有具体对象：点名了这件事/这个人/这个场景，不是泛指
- 有个人视角：看得出是他从这段经历里得出的，不是别人说烂的道理
- 有边界、能被这件事检验：说得出它适用到哪为止，而不是放之四海皆准

要打回的六类（命中任一即打回）：
- 鸡汤：名言警句、励志金句（「坚持就是胜利」）
- 正确的废话：无信息量（「这件事让我更成熟」「要学会放下」）
- 别人的观点：复述他人（「细节决定成败」「选择比努力重要」）
- 无主语感想：没主语的泛感叹（「生活就是这样」「人心难测」）
- 大词伪深刻：用「人性/社会/时代/格局/圈层」等大词下的抽象结论，看着深，其实落不回这件事、也没法被反例检验（「现在的人都太浮躁」）
- 单因甩锅：把相关当因果、一句话归因（「都是他害的」「穷就是因为懒」），隐藏了共同原因或别的因素

打回后，从三把「证伪」的刀里选最戳这句的一把，只问一个（必须结合他这句话的具体内容，不许原样甩模板）：
- 反例：「能想到一件反例吗？有的话这话该怎么收窄？」
- 前提：「你这么说默认了什么前提？这前提今天成立吗？」
- 因果：「是 A 导致 B，还是有件别的事同时影响了两边？」

输出要求：
1. 只输出一句话，45 字以内，形式是「判定 + 一个追问」
2. 打回 → 点名是哪一类 + 用选中的那把刀追问，绝不给改写、句式或答案
3. 立得住 → 简短肯定一句即可（如「有你的视角，也立得住」），不啰嗦
4. 不加前缀、解释、引号

示例：
判断「细节决定成败」
√「这是别人的观点。放到今天，是哪个细节？」

判断「现在的人都太浮躁」
√「这是大词空话。今天哪个人哪个动作让你这么觉得？」

判断「我今天累，全是开会害的」
√「这是单因归因。不开会你就不累了吗？」

判断「老王迟到是昨晚又喝多，他这阵子一直在硬撑」
√「有具体对象也有你的观察，立得住。」`

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
