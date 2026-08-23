// 数据层：造货记录的云存储（Supabase）
import type { HuoEntry, Tag } from '../types'
import { getClient } from './supabase'

interface EntryRow {
  id: string
  date: string
  happened: string
  thought: string
  judgment: string
  tag: string
  image_id: string | null
  created_at: string
}

function toEntry(row: EntryRow): HuoEntry {
  return {
    id: row.id,
    date: row.date,
    happened: row.happened,
    thought: row.thought,
    judgment: row.judgment,
    tag: row.tag as Tag,
    createdAt: new Date(row.created_at).getTime(),
    imageId: row.image_id ?? undefined,
  }
}

export async function loadEntries(): Promise<HuoEntry[]> {
  const { data, error } = await getClient()
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data as EntryRow[]) || []).map(toEntry)
}

export async function saveEntry(entry: HuoEntry): Promise<void> {
  const { error } = await getClient()
    .from('entries')
    .upsert({
      id: entry.id,
      date: entry.date,
      happened: entry.happened,
      thought: entry.thought,
      judgment: entry.judgment,
      tag: entry.tag,
      image_id: entry.imageId ?? null,
      created_at: new Date(entry.createdAt).toISOString(),
    })
  if (error) throw error
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await getClient().from('entries').delete().eq('id', id)
  if (error) throw error
}
