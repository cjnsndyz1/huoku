import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { TAGS, type Tag } from '../types'
import { deleteEntry, formatDate, loadHistory } from '../utils/storage'
import { deleteImage, loadImage } from '../utils/imageStore'

function EntryImage({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let alive = true
    loadImage(imageId)
      .then((blob) => {
        if (alive && blob) setUrl(URL.createObjectURL(blob))
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
  const [refresh, setRefresh] = useState(0)
  const [filter, setFilter] = useState<Tag | '全部'>('全部')
  const history = useMemo(() => loadHistory(), [refresh])

  const list = filter === '全部' ? history : history.filter((e) => e.tag === filter)

  const remove = (entry: { id: string; imageId?: string }) => {
    deleteEntry(entry.id)
    if (entry.imageId) deleteImage(entry.imageId).catch(() => {})
    setRefresh((n) => n + 1)
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

      {list.length === 0 ? (
        <p className="empty">还没有货。去记第一条吧。</p>
      ) : (
        <div className="entry-list">
          {list.map((e) => (
            <article key={e.id} className="entry">
              <div className="entry-meta">
                <span className="entry-date">{formatDate(e.date)}</span>
                <span className="entry-tag">{e.tag}</span>
                <button type="button" className="entry-del" onClick={() => remove(e)} title="删除">
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
