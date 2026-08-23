import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Sparkles, CircleAlert, Camera, X } from 'lucide-react'
import { TAGS, type Tag, type HuoEntry } from '../types'
import { saveEntry, todayStr } from '../utils/storage'
import { callCoach } from '../services/coachService'
import { compressImage, deleteImage, saveImage } from '../utils/imageStore'

export default function RecordPage() {
  const navigate = useNavigate()
  const [happened, setHappened] = useState('')
  const [thought, setThought] = useState('')
  const [judgment, setJudgment] = useState('')
  const [tag, setTag] = useState<Tag>('生活')

  const [digLoading, setDigLoading] = useState(false)
  const [digResult, setDigResult] = useState('')
  const [digError, setDigError] = useState('')

  const [clicheLoading, setClicheLoading] = useState(false)
  const [clicheResult, setClicheResult] = useState('')
  const [clicheError, setClicheError] = useState('')

  const [imageId, setImageId] = useState<string | undefined>()
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const [imageError, setImageError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const canSave = happened.trim() !== '' && thought.trim() !== '' && judgment.trim() !== ''

  const dig = async () => {
    setDigLoading(true)
    setDigError('')
    setDigResult('')
    try {
      const q = await callCoach('dig', { happened, thought })
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
      const id = crypto.randomUUID()
      await saveImage(id, blob)
      if (imageId) deleteImage(imageId).catch(() => {})
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      setImageId(id)
      setImageUrl(URL.createObjectURL(blob))
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '图片处理失败')
    }
  }

  const removeImage = () => {
    if (imageId) deleteImage(imageId).catch(() => {})
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageId(undefined)
    setImageUrl(undefined)
  }

  const save = () => {
    if (!canSave) return
    const entry: HuoEntry = {
      id: crypto.randomUUID(),
      date: todayStr(),
      happened: happened.trim(),
      thought: thought.trim(),
      judgment: judgment.trim(),
      tag,
      createdAt: Date.now(),
      imageId,
    }
    saveEntry(entry)
    navigate('/library')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>记一条货</h1>
      </header>

      <div className="form">
        <label className="field">
          <span className="field-label">发生了什么</span>
          <textarea
            value={happened}
            onChange={(e) => setHappened(e.target.value)}
            placeholder="今天一件真实的小事，哪怕再小…"
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
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pickImage} />
        </div>

        <label className="field">
          <span className="field-label">我怎么想</span>
          <textarea
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="往下挖一层：为什么会这样？我当时什么感受？"
            rows={3}
          />
        </label>

        {happened.trim() !== '' && (
          <div className="coach">
            <button type="button" className="btn btn-ghost coach-btn" disabled={digLoading} onClick={dig}>
              <Sparkles size={16} /> {digLoading ? 'AI 正在想…' : 'AI 帮我挖'}
            </button>
            {digResult && <p className="coach-result">{digResult}</p>}
            {digError && <p className="coach-error">{digError}</p>}
          </div>
        )}

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

        <button type="button" className="btn btn-primary btn-lg" disabled={!canSave} onClick={save}>
          <Check size={18} /> 存进货库
        </button>
      </div>
    </div>
  )
}
