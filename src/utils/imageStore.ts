// 图片压缩工具：把图片文件压缩到最长边 maxDim 的 JPEG Blob（降低存储占用）。

/** 把图片文件压缩到最长边 maxDim 的 JPEG Blob（降低存储占用） */
export async function compressImage(file: File, maxDim = 800): Promise<Blob> {
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('图片加载失败'))
    el.src = url
  })

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error('canvas 不可用')
  }
  ctx.drawImage(img, 0, 0, w, h)
  URL.revokeObjectURL(url)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('压缩失败'))), 'image/jpeg', 0.7)
  })
}
