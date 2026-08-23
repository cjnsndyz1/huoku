export type Tag = '工作' | '生活' | '关系' | '自我' | '观点' | '其他'

export const TAGS: Tag[] = ['工作', '生活', '关系', '自我', '观点', '其他']

/** 一条"货"：每天从生活里挖出的一句自己的话 */
export interface HuoEntry {
  id: string
  /** 本地日期，如 2026-08-22 */
  date: string
  /** 第一行：今天发生了什么 */
  happened: string
  /** 第二行：我怎么想（往下挖一层"为什么"） */
  thought: string
  /** 第三行：一句话判断（我的答案，不是套话） */
  judgment: string
  tag: Tag
  createdAt: number
  /** 可选：配图在 Supabase Storage 里的路径（拍照/选图录入） */
  imageId?: string
}
