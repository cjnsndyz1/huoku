# 货库 · 表达训练系统

> 每天把一件真实小事，挖成一句属于自己的话。

## 这是什么

一个单人自用的**「货库」**——表达训练工具。它不教你口才技巧，而是帮你解决一个更根子的问题：**脑子里没货**。

很多人表达差，不是"说不好"，而是"没货可说"。货库让你每天挖一件真实小事，通过三行（**发生了什么 → 我怎么想 → 一句话判断**）把它提炼成一句自己的判断，攒起来、定期回看，重建「感知 → 思考 → 表达」的链路。

## 功能

- **记货**：三行记录 + 标签 + 拍照
- **AI 造货教练**：卡住时追问你"为什么"、检测你的"套话"（只追问、不代答）
- **货库**：翻看、筛选、删除攒下的货
- **回看**：1 / 3 / 7 / 14 / 30 天前的旧货自动浮现（间隔复习）
- **进步**：连续天数、打卡日历、里程碑庆祝
- **备份**：JSON 一键导出 / 导入

## 技术栈

- React 19 + Vite + TypeScript
- React Router 7
- lucide-react 图标
- **Supabase**（数据云同步 + 邮箱认证）+ **Supabase Storage**（配图云存储）
- localStorage（DeepSeek 配置 + Supabase 配置）
- 前端直连 DeepSeek（OpenAI 兼容协议）

## 本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173

## 云端配置（Supabase）

数据存 Supabase，多设备自动同步。一次性配好即可：

1. **注册建项目**：supabase.com → New Project（Region 选 Singapore）→ 进 SQL Editor 粘贴下面的 SQL → Run：

```sql
-- 文字记录表
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date text not null,
  happened text not null,
  thought text not null,
  judgment text not null,
  tag text not null,
  image_id text,
  created_at timestamptz default now()
);
alter table entries enable row level security;
create policy "读自己的" on entries for select using (auth.uid() = user_id);
create policy "写自己的" on entries for insert with check (auth.uid() = user_id);
create policy "改自己的" on entries for update using (auth.uid() = user_id);
create policy "删自己的" on entries for delete using (auth.uid() = user_id);

-- 配图存储（private bucket，按用户隔离）
insert into storage.buckets (id, name, public) values ('images', 'images', false);
create policy "images_select" on storage.objects for select to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
```

2. **关邮箱验证**：Authentication → Providers → Email → 关掉 Confirm email
3. **拿 key**：Project Settings → API → 复制 Project URL 和 anon public key
4. 打开货库 → 设置 → 填 URL + Anon Key → 填邮箱密码注册登录

## 部署

纯静态站点，任何静态托管都能跑（GitHub Pages、Vercel、Cloudflare Pages 等）：

1. 把 `dist/` 构建产物（或整个仓库）部署到任意静态托管
2. 打开后进入「设置」，填 Supabase 配置（登录）+ DeepSeek API Key
3. 即可使用

**为什么 AI 不用后端**：DeepSeek Key 只存在你自己的浏览器里，产品里没有"公共 key"——别人打开网页用的是他们自己的 key（花他们自己的钱），你的额度不会被白嫖。**数据安全**由 Supabase RLS 保证（别人登录也看不到你的记录）。

## 目录结构

```
src/
  pages/             # 首页 / 记录 / 货库 / 回看 / 进步 / 设置
  services/          # Supabase、数据读写、图片云存储、AI 教练（前端直连 + 提示词）
  utils/             # 存储、统计、图片压缩
  hooks/             # useEntries 数据加载 hook
  components/        # SetupGuide 引导组件
货库表达训练系统-PRD-2026-08-23.md   # 产品需求文档
```

## 设计理念

这个工具的核心信念只有一句：

> **表达能力的根，是"从生活里持续造货"的能力，不是"把货倒出来"的技巧。**

所以 AI 教练只追问、不代答——一旦 AI 替你思考，你就练不到"自己想"了。
