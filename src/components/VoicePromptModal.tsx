import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import type { HuoEntry } from '../types'
import {
  VOICE_SCENARIOS,
  buildShipPrompt,
  copyTextToClipboard,
  type ShipPromptMode,
  type ShipPromptScenario,
} from '../services/shipPrompt'

interface Props {
  entry: HuoEntry
  onClose: () => void
}

const MODES: { id: ShipPromptMode; name: string }[] = [
  { id: 'gentle', name: '温和·说完再追问' },
  { id: 'stress', name: '压力·随时打断' },
]

/**
 * F10 语音提示词出口弹窗（V2.1）：选场景 + 选强度 → 一键复制提示词 → 去外部语音产品亲口开口。
 * 货库不做语音对练；本弹窗只产出纯文本提示词，不调 AI、不落库、不留历史。
 */
export default function VoicePromptModal({ entry, onClose }: Props) {
  const [scenario, setScenario] = useState<ShipPromptScenario>('report')
  const [mode, setMode] = useState<ShipPromptMode>('gentle')
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const previewRef = useRef<HTMLTextAreaElement>(null)

  const prompt = useMemo(() => buildShipPrompt(entry, scenario, mode), [entry, scenario, mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    const result = await copyTextToClipboard(prompt)
    if (result === 'clipboard') {
      setManual(false)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      // 兜底：自动复制失败时，让用户在只读框里全选后手动复制
      setManual(true)
      previewRef.current?.focus()
      previewRef.current?.select()
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div
        className="ship"
        role="dialog"
        aria-modal="true"
        aria-label="复制语音提示词"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ship-head">
          <h2 className="ship-title">复制语音提示词</h2>
          <button type="button" className="ship-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <p className="ship-hint">
          选好场景和强度，复制后到豆包语音/视频对话里粘贴，亲口说满 60 秒。实时对练和打断交给外部产品，货库只帮你把货和规则带齐。
        </p>

        <div className="ship-scenarios">
          {VOICE_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tag ${scenario === s.id ? 'tag-active' : ''}`}
              onClick={() => setScenario(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="ship-scenarios">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`tag ${mode === m.id ? 'tag-active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="ship-entry">
          <span className="ship-entry-label">你要说的货</span>
          <p className="ship-entry-text">{entry.judgment || entry.thought || entry.happened}</p>
        </div>

        <div style={{ padding: '0 20px 12px' }}>
          <textarea
            ref={previewRef}
            readOnly
            rows={9}
            value={prompt}
            aria-label="提示词预览"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              padding: '10px 12px',
              fontSize: '12.5px',
              lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink)',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
            }}
          />
        </div>

        <button type="button" className="btn btn-primary ship-start" onClick={copy}>
          {copied ? (
            <>
              <Check size={16} /> 已复制，去开口说 60 秒
            </>
          ) : (
            <>
              <Copy size={16} /> 复制提示词
            </>
          )}
        </button>

        {manual && (
          <p className="ship-hint" style={{ paddingBottom: 14 }}>
            自动复制没成功：请在上方文本框全选（Ctrl+A）后手动复制（Ctrl+C），再粘贴到语音产品。
          </p>
        )}
      </div>
    </div>
  )
}
