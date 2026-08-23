import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Zap } from 'lucide-react'
import {
  DEFAULT_CONFIG,
  loadApiConfig,
  saveApiConfig,
  testApiConfig,
} from '../services/coachService'

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState(loadApiConfig().baseUrl)
  const [apiKey, setApiKey] = useState(loadApiConfig().apiKey)
  const [model, setModel] = useState(loadApiConfig().model)
  const [msg, setMsg] = useState('')
  const [testing, setTesting] = useState(false)

  const save = () => {
    saveApiConfig({
      baseUrl: baseUrl.trim() || DEFAULT_CONFIG.baseUrl,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_CONFIG.model,
    })
    setMsg('已保存')
  }

  const test = async () => {
    setTesting(true)
    setMsg('')
    const result = await testApiConfig({ baseUrl, apiKey, model })
    setMsg(result)
    setTesting(false)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>设置 · AI 配置</h1>
      </header>

      <p className="subtitle">
        AI 教练走你自己的 DeepSeek，Key 只存在你浏览器里，不经过任何服务器。
      </p>

      <div className="form">
        <label className="field">
          <span className="field-label">API Key</span>
          <input
            type="text"
            className="text-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </label>

        <label className="field">
          <span className="field-label">模型名</span>
          <input
            type="text"
            className="text-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat"
          />
        </label>

        <label className="field">
          <span className="field-label">Base URL（一般不用改）</span>
          <input
            type="text"
            className="text-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
        </label>

        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            <Save size={16} /> 保存
          </button>
          <button type="button" className="btn btn-ghost" onClick={test} disabled={testing}>
            <Zap size={16} /> {testing ? '测试中…' : '测试连接'}
          </button>
        </div>

        {msg && <p className="backup-msg">{msg}</p>}
      </div>
    </div>
  )
}
