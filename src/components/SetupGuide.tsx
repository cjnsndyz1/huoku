import { Link } from 'react-router-dom'
import { Cloud } from 'lucide-react'

export default function SetupGuide() {
  return (
    <div className="page page-center">
      <Cloud size={30} className="setup-icon" />
      <h2 className="setup-title">先把数据接到云端</h2>
      <p className="setup-desc">
        配置 Supabase 并登录后，你的货就能在电脑手机间自动同步，真正沉淀成数字资产。
      </p>
      <Link to="/settings" className="btn btn-primary btn-lg">
        去设置
      </Link>
    </div>
  )
}
