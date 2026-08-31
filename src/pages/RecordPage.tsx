import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Sparkles,
  CircleAlert,
  Camera,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { TAGS, type Tag, type HuoEntry } from '../types'
import { todayStr } from '../utils/storage'
import { saveEntry } from '../services/dataService'
import { callCoach } from '../services/coachService'
import { compressImage } from '../utils/imageStore'
import { uploadImage } from '../services/imageService'

// 今日三问：线索式问句，治「打开页面不知道写什么」的白纸障碍
const QUESTIONS = [
  '今天第一个跟你说话的人是谁？他说了什么？',
  '刚才哪句话或哪个画面，让你心里动了一下？',
  '今天哪件小事让你皱眉，或让你笑了一下？',
  '今天你走路或坐车时，眼睛落在什么上面了？',
  '今天谁做的一件事，让你觉得「原来还可以这样」？',
  '今天有没有一刻，你想说话却咽回去了？',
  '今天最费你时间的一件事是什么？',
  '今天你吃到、闻到或听到的什么，让你停了一下？',
]

function pickThree(arr: string[]): string[] {
  const copy = [...arr]
  const out: string[] = []
  while (copy.length && out.length < 3) {
    const i = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(i, 1)[0])
  }
  return out
}

const STEPS = [
  { n: 1 as const, label: '发生了什么' },
  { n: 2 as const, label: '我怎么想' },
  { n: 3 as const, label: '一句话判断' },
]

// P0-2：草稿持久化——写一半刷新/切页/误关不丢
const DRAFT_KEY = 'biaodaxunlian:record-draft'

interface Draft {
  happened: string
  thought: string
  judgment: string
  tag: Tag
  savedAt: number
  hadImage?: boolean
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    if (
      typeof d.happened !== 'string' ||
      typeof d.thought !== 'string' ||
      typeof d.judgment !== 'string' ||
      typeof d.tag !== 'string'
    ) {
      return null
    }
    return d
  } catch {
    return null
  }
}

export default function RecordPage() {
  const navigate = useNavigate()
  const [draft] = useState(readDraft)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [questions] = useState<string[]>(() => pickThree(QUESTIONS))
  const [happened, setHappened] = useState(draft?.happened ?? '')
  const [thought, setThought] = useState(draft?.thought ?? '')
  const [judgment, setJudgment] = useState(draft?.judgment ?? '')
  const [tag, setTag] = useState<Tag>(draft?.tag ?? '生活')
  const [restored, setRestored] = useState(() => {
    const hasText = draft && (draft.happened.trim() || draft.thought.trim() || draft.judgment.trim())
    return Boolean(hasText)
  })
  // P1-5：今日三问只当提示，不把问句填进内容（否则不改就保存会把问句存成货）
  const [activeQuestion, setActiveQuestion] = useState('')
  const happenedRef = useRef<HTMLTextAreaElement>(null)

  const pickQuestion = (q: string) => {
    setActiveQuestion(q)
    happenedRef.current?.focus()
  }

  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const [imageError, setImageError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 防抖写入草稿；全空则移除
  const draftTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (draftTimer.current) window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      try {
        if (happened.trim() || thought.trim() || judgment.trim()) {
          const d: Draft = { happened, thought, judgment, tag, savedAt: Date.now(), hadImage: !!imageBlob }
          localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
        } else {
          localStorage.removeItem(DRAFT_KEY)
        }
      } catch {
        /* 隐私模式/存储满时静默降级 */
      }
    }, 400)
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current)
    }
  }, [happened, thought, judgment, tag, imageBlob])

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* 忽略 */
    }
    setHappened('')
    setThought('')
    setJudgment('')
    setTag('生活')
    setRestored(false)
  }

  // 文字被手动清空时，恢复提示条自动消失
  useEffect(() => {
    if (restored && !happened.trim() && !thought.trim() && !judgment.trim()) {
      setRestored(false)
    }
  }, [happened, thought, judgment, restored])

  const [digLoading, setDigLoading] = useState(false)
  const [digResult, setDigResult] = useState('')
  const [digError, setDigError] = useState('')

  const [clicheLoading, setClicheLoading] = useState(false)
  const [clicheResult, setClicheResult] = useState('')
  const [clicheError, setClicheError] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // P0-2：至少一项非空即可保存（不再逼着写满三行）
  const canSave = happened.trim() !== '' || thought.trim() !== '' || judgment.trim() !== ''

  const dig = async () => {
    setDigLoading(true)
    setDigError('')
    setDigResult('')
    try {
      const q = await callCoach('dig', { happened, thought, lastQuestion: digResult || undefined })
      setDigResult(q)
    } catch (e) {
      setDigError(e instanceof Error ? e.message : '调用失败')
    } finally {
      setDigLoading(false)
    }
  }

  const checkCliche = async () => {
    setClicheLoading(true)
    setClicheError('')
    setClicheResult('')
    try {
      const fb = await callCoach('cliche', { judgment })
      setClicheResult(fb)
    } catch (e) {
      setClicheError(e instanceof Error ? e.message : '调用失败')
    } finally {
      setClicheLoading(false)
    }
  }

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError('')
    try {
      const blob = await compressImage(file)
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      setImageBlob(blob)
      setImageUrl(URL.createObjectURL(blob))
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '图片处理失败')
    }
  }

  const removeImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageBlob(null)
    setImageUrl(undefined)
  }

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setSaveError('')
    try {
      let imagePath: string | undefined
      if (imageBlob) {
        imagePath = await uploadImage(imageBlob)
      }
      const entry: HuoEntry = {
        id: crypto.randomUUID(),
        date: todayStr(),
        happened: happened.trim(),
        thought: thought.trim(),
        judgment: judgment.trim(),
        tag,
        createdAt: Date.now(),
        imageId: imagePath,
      }
      await saveEntry(entry)
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* 忽略 */
      }
      navigate('/library')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>记一条货</h1>
      </header>

      <div className="steps">
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`step-item ${step === s.n ? 'step-active' : ''} ${s.n < step ? 'step-done' : ''}`}
            onClick={() => setStep(s.n)}
          >
            <span className="step-num">{s.n < step ? <Check size={12} /> : s.n}</span>
            <span className="step-label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="form">
        {restored && (
          <div className="draft-note">
            <span>
              上次写了一半的草稿已找回
              {draft?.hadImage && !imageBlob ? '（配图没保住，可重新拍一张）' : ''}
            </span>
            <button type="button" className="draft-clear" onClick={clearDraft}>
              清掉
            </button>
          </div>
        )}

        {step === 1 && (
          <>
            {happened.trim() === '' && (
              <div className="today-questions">
                <p className="tq-title">今天想不起记什么？挑一个问句，答在下面</p>
                {questions.map((q) => (
                  <button key={q} type="button" className="tq-btn" onClick={() => pickQuestion(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            <label className="field">
              <span className="field-label">发生了什么</span>
              <textarea
                ref={happenedRef}
                value={happened}
                onChange={(e) => setHappened(e.target.value)}
                placeholder={activeQuestion || '今天一件真实的小事，哪怕再小… 想不起来就留空，交给 AI 帮你想'}
                rows={2}
              />
            </label>

            <div className="photo-area">
              {imageUrl ? (
                <div className="photo-preview">
                  <img src={imageUrl} alt="配图" />
                  <button type="button" className="photo-remove" onClick={removeImage} title="移除图片">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost photo-btn" onClick={() => fileRef.current?.click()}>
                  <Camera size={16} /> 拍下让你有感觉的一刻
                </button>
              )}
              {imageError && <p className="coach-error">{imageError}</p>}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={pickImage}
              />
            </div>

            {happened.trim() === '' && (
              <div className="coach">
                <button type="button" className="btn btn-ghost coach-btn" disabled={digLoading} onClick={dig}>
                  <Sparkles size={16} /> {digLoading ? 'AI 正在想…' : 'AI 帮我想起今天的事'}
                </button>
                <p className="coach-hint">想不起来时，让 AI 问几个问题帮你回忆</p>
                {digResult && <p className="coach-result">{digResult}</p>}
                {digError && <p className="coach-error">{digError}</p>}
              </div>
            )}

            <div className="step-nav">
              <span />
              <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                下一步 <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="field">
              <span className="field-label">我怎么想</span>
              <textarea
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                placeholder="往下挖一层：为什么会这样？我当时什么感受？"
                rows={3}
              />
            </label>

            <div className="coach">
              <button type="button" className="btn btn-ghost coach-btn" disabled={digLoading} onClick={dig}>
                <Sparkles size={16} /> {digLoading ? 'AI 正在想…' : 'AI 帮我挖'}
              </button>
              <p className="coach-hint">基于「发生了什么」和「我怎么想」提问，挖得更深一层</p>
              {digResult && <p className="coach-result">{digResult}</p>}
              {digError && <p className="coach-error">{digError}</p>}
            </div>

            <div className="step-nav">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> 上一步
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                下一步 <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="field">
              <span className="field-label">一句话判断</span>
              <textarea
                value={judgment}
                onChange={(e) => setJudgment(e.target.value)}
                placeholder="我的答案，不是套话。比如「它不是 X，而是 Y」"
                rows={2}
              />
            </label>

            {judgment.trim() !== '' && (
              <div className="coach">
                <button type="button" className="btn btn-ghost coach-btn" disabled={clicheLoading} onClick={checkCliche}>
                  <CircleAlert size={16} /> {clicheLoading ? '检测中…' : '查是不是套话'}
                </button>
                <p className="coach-hint">只看「一句话判断」，检测它是你的判断还是套话</p>
                {clicheResult && <p className="coach-result">{clicheResult}</p>}
                {clicheError && <p className="coach-error">{clicheError}</p>}
              </div>
            )}

            <div className="tags">
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tag ${tag === t ? 'tag-active' : ''}`}
                  onClick={() => setTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="step-nav">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                <ChevronLeft size={16} /> 上一步
              </button>
              <button type="button" className="btn btn-primary btn-lg" disabled={!canSave || saving} onClick={save}>
                <Check size={18} /> {saving ? '保存中…' : '存进货库'}
              </button>
            </div>
            {saveError && <p className="coach-error">{saveError}（请检查云同步配置）</p>}
          </>
        )}
      </div>
    </div>
  )
}
