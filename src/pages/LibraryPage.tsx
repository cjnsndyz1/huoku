import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { TAGS, type Tag } from '../types'
import { formatDate } from '../utils/storage'
import { deleteImage, getSignedUrl } from '../services/imageService'
import { deleteEntry } from '../services/dataService'
import { useEntries } from '../hooks/useEntries'
import SetupGuide from '../components/SetupGuide'

function EntryImage({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let alive = true
    getSignedUrl(imageId)
      .then((u) => {
        if (alive && u) setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [imageId])

  if (!url) return null
  return <img src={url} className="entry-image" alt="配图" />
}

export default function LibraryPage() {
  const [filter, setFilter] = useState<Tag | '全部'>('全部')
  const { entries, loading, error, needsSetup, refresh } = useEntries()

  const list = filter === '全部' ? entries : entries.filter((e) => e.tag === filter)

  const remove = async (id: string, imageId?: string) => {
    try {
      await deleteEntry(id)
      if (imageId) deleteImage(imageId).catch(() => {})
      await refresh()
    } catch {
      /* 删除失败静默，刷新后可见 */
    }
  }

  if (needsSetup) return <SetupGuide />
  if (error) {
    return (
      <div className="page page-center">
        <p className="coach-error">{error}</p>
        <Link to="/settings" className="btn btn-ghost">
          去设置
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>货库</h1>
      </header>

      <div className="filter">
        {(['全部', ...TAGS] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`tag ${filter === t ? 'tag-active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">加载中…</p>
      ) : list.length === 0 ? (
        <p className="empty">还没有货。去记第一条吧。</p>
      ) : (
        <div className="entry-list">
          {list.map((e) => (
            <article key={e.id} className="entry">
              <div className="entry-meta">
                <span className="entry-date">{formatDate(e.date)}</span>
                <span className="entry-tag">{e.tag}</span>
                <button type="button" className="entry-del" onClick={() => remove(e.id, e.imageId)} title="删除">
                  <Trash2 size={14} />
                </button>
              </div>
              {e.imageId && <EntryImage imageId={e.imageId} />}
              <p className="entry-happened">{e.happened}</p>
              <p className="entry-thought">{e.thought}</p>
              <p className="entry-judgment">{e.judgment}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
