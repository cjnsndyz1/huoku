import { useEffect, useRef, useState } from 'react'
import { X, Send, Mic, RefreshCw, Copy } from 'lucide-react'
import type { HuoEntry } from '../types'
import { SHIP_SCENARIOS, shipCoach, type ShipMessage, type ShipScenario } from '../services/coachService'
import VoicePromptModal from './VoicePromptModal'

interface Props {
  entry: HuoEntry
  onClose: () => void
}

/**
 * 出货练习（P3）：把一条货「说出口」。
 * AI 扮场景里的听众（领导/朋友/饭桌熟人/持不同意见的人），只追问、复述、点结构，绝不代写。
 * 练完即弃，不落库——重点在「开口说」这个动作，不在存档。
 */
export default function ShipPractice({ entry, onClose }: Props) {
  const [scenario, setScenario] = useState<ShipScenario>(SHIP_SCENARIOS[0])
  const [history, setHistory] = useState<ShipMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [started, setStarted] = useState(false)
  const [rounds, setRounds] = useState(0)
  // F10：改用外部语音对练时弹出的提示词出口
  const [voiceOpen, setVoiceOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const entryContent = {
    happened: entry.happened,
    thought: entry.thought,
    judgment: entry.judgment,
  }

  const start = async () => {
    setLoading(true)
    setErr('')
    try {
      const opening = await shipCoach({ entry: entryContent, scenario, history: [] })
      setHistory([{ role: 'assistant', content: opening }])
      setStarted(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调用失败')
    } finally {
      setLoading(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const nextHistory: ShipMessage[] = [...history, { role: 'user', content: text }]
    setHistory(nextHistory)
    setInput('')
    setLoading(true)
    setErr('')
    try {
      const reply = await shipCoach({ entry: entryContent, scenario, history: nextHistory })
      setHistory([...nextHistory, { role: 'assistant', content: reply }])
      setRounds((r) => r + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调用失败')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setHistory([])
    setStarted(false)
    setRounds(0)
    setInput('')
    setErr('')
  }

  const pickScenario = (s: ShipScenario) => {
    if (started) return
    setScenario(s)
    reset()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="ship" role="dialog" aria-modal="true" aria-label="出货练习" onClick={(e) => e.stopPropagation()}>
        <div className="ship-head">
          <h2 className="ship-title">说出来</h2>
          <button type="button" className="ship-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <p className="ship-hint">
          挑个真实场景，AI 扮听众只追问、复述、点结构，绝不替你写。说多少算多少，卡壳就说「不知道」。
        </p>

        <div className="ship-scenarios">
          <button type="button" className="btn btn-ghost" onClick={() => setVoiceOpen(true)}>
            <Copy size={14} /> 先口头说一遍：复制语音提示词，去语音对练
          </button>
        </div>

        <div className="ship-scenarios">
          {SHIP_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`tag ${scenario.id === s.id ? 'tag-active' : ''}`}
              disabled={started}
              onClick={() => pickScenario(s)}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="ship-entry">
          <span className="ship-entry-label">你要说的货</span>
          <p className="ship-entry-text">{entry.judgment || entry.thought || entry.happened}</p>
        </div>

        {history.length > 0 && (
          <div className="ship-log">
            {history.map((m, i) => (
              <div key={i} className={`ship-msg ${m.role === 'assistant' ? 'ship-msg-ai' : 'ship-msg-me'}`}>
                <span className="ship-msg-role">{m.role === 'assistant' ? scenario.role : '我'}</span>
                <p className="ship-msg-text">{m.content}</p>
              </div>
            ))}
            {loading && (
              <div className="ship-msg ship-msg-ai">
                <span className="ship-msg-role">{scenario.role}</span>
                <p className="ship-msg-text ship-msg-dots">…</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {err && <p className="coach-error">{err}</p>}

        {!started ? (
          <button type="button" className="btn btn-primary ship-start" disabled={loading} onClick={start}>
            <Mic size={16} /> {loading ? '听众就位…' : `开始，向「${scenario.role}」说`}
          </button>
        ) : (
          <div className="ship-input">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`对「${scenario.role}」说…`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <button type="button" className="btn btn-primary" disabled={loading || !input.trim()} onClick={send}>
              <Send size={16} /> 说
            </button>
          </div>
        )}

        {started && (
          <div className="ship-foot">
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <RefreshCw size={14} /> 换场景重来
            </button>
            <span className="ship-rounds">{rounds > 0 ? `已说 ${rounds} 轮` : '说吧，别怕说不好'}</span>
          </div>
        )}
      </div>

      {voiceOpen && <VoicePromptModal entry={entry} onClose={() => setVoiceOpen(false)} />}
    </div>
  )
}
