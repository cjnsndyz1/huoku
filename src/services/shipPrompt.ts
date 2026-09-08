// F10 语音提示词出口（V2.1）
// 纯前端：不调 AI、不花 token、不读写数据库、不依赖网络，断网也能用。
// 作用：把一条真货 + 场景 + 模式拼成一段提示词，复制到外部语音产品（豆包语音/视频对话）亲口开口。
// 能力外接：实时语音对练、随机打断由外部成熟产品承担，货库只负责"把货和训练规则带齐"，绝不自建语音。

import type { HuoEntry } from '../types'
import { SHIP_SCENARIOS } from './coachService'

/** 语音对练场景 key：沿用 F09 的四个，并新增 retell（口头转述，治"听→抓→组→说"卡顿） */
export type ShipPromptScenario = 'report' | 'chat' | 'dinner' | 'convince' | 'retell'
/** 对练模式：gentle 温和=说完再追问；stress 压力=随时打断 */
export type ShipPromptMode = 'gentle' | 'stress'

interface VoiceScenario {
  id: ShipPromptScenario
  name: string
  /** AI 扮演的听众身份 */
  role: string
  /** 该场景本轮要练的具体目标，会拼进提示词 */
  goal: string
}

// 前四个场景的名称/角色复用 F09 的 SHIP_SCENARIOS，保持单一来源，避免两处维护；retell 为语音出口新增。
const SCENARIO_GOAL: Record<Exclude<ShipPromptScenario, 'retell'>, string> = {
  report: '我要练的是结论先行：第一句就给结论，再给理由和一个例子，最后说我需要你做什么。',
  chat: '我要练的是自然讲述，像真人聊天，不要汇报腔，允许有口语，但要有一条清楚的主线。',
  dinner: '我要练的是被点名后 3 秒内接住，先给一句观点再展开，讲得短、讲得有意思。',
  convince: '我要练的是先说出你立场里合理的部分，再补我的不同角度和依据，最后给一个可落地建议。',
}

const RETELL_SCENARIO: VoiceScenario = {
  id: 'retell',
  name: '口头转述',
  role: '没在场的同事/领导',
  goal: '我会把我“听到的一件事”讲给你这个不在场的人听，你要追问我漏掉的关键信息（谁、做了什么、为什么、要我做什么），逼我先抓重点再按顺序重组，不许我照背原文。',
}

export const VOICE_SCENARIOS: VoiceScenario[] = [
  ...SHIP_SCENARIOS.map((s) => ({
    id: s.id as ShipPromptScenario,
    name: s.name,
    role: s.role,
    goal: SCENARIO_GOAL[s.id as Exclude<ShipPromptScenario, 'retell'>],
  })),
  RETELL_SCENARIO,
]

const MODE_BEHAVIOR: Record<ShipPromptMode, string> = {
  gentle: '等我把一段说完、停下来后再开口追问',
  stress: '可以随时打断我，每 2–3 轮换一个我没准备的角度追问',
}

const EMPTY_PLACEHOLDER = '（未写）'

function fillLine(v?: string): string {
  const t = v?.trim()
  return t ? t : EMPTY_PLACEHOLDER
}

/**
 * 纯函数：把一条货拼成可直接粘贴到外部语音产品的提示词。
 * 三行原样嵌入、不改写不润色不补全；任一行为空以（未写）占位但不阻塞生成。
 */
export function buildShipPrompt(
  entry: Pick<HuoEntry, 'happened' | 'thought' | 'judgment'>,
  scenario: ShipPromptScenario,
  mode: ShipPromptMode,
): string {
  const sc = VOICE_SCENARIOS.find((s) => s.id === scenario) ?? VOICE_SCENARIOS[0]
  return [
    `你现在扮演我现实中的${sc.role}，我们用语音对话，你只能听我说、然后口头回应我，不要输出大段文字。`,
    '',
    '我要练的是把下面这件我真实经历的事，亲口说清楚：',
    `- 发生了什么：${fillLine(entry.happened)}`,
    `- 我当时怎么想：${fillLine(entry.thought)}`,
    `- 我的一句话判断：${fillLine(entry.judgment)}`,
    '',
    '你要遵守四条铁律：',
    '1. 只做三件事：追问、用你自己的话复述我刚说的、点出我结构上哪里清楚/哪里绕；绝不替我说完整句子、绝不给我成稿、绝不给我打分。',
    `2. ${MODE_BEHAVIOR[mode]}。`,
    '3. 如果我说“我卡了”，只给我一个关键词提示，不许给整句。',
    '4. 等我讲完，用三句话收尾：哪里讲清楚了、哪里还绕、再追问我一个问题让我重说一遍那段。',
    '',
    `${sc.goal}现在开始：你先用这个身份，用一句很自然的口头话起个头，等我开口。`,
  ].join('\n')
}

export type CopyResult = 'clipboard' | 'manual'

/**
 * 复制文本：优先 navigator.clipboard；不可用（非 HTTPS / 旧浏览器）时返回 'manual'，
 * 由 UI 弹出"全选后手动复制"的只读文本框兜底。纯前端，断网可用。
 */
export async function copyTextToClipboard(text: string): Promise<CopyResult> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return 'clipboard'
    }
    throw new Error('clipboard-api-unavailable')
  } catch {
    return 'manual'
  }
}
