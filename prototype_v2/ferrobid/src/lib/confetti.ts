/* Lightweight canvas confetti — fired when the buyer wins a lot. */

const COLORS = ['#E4572E', '#2B4C7E', '#1E7F4F', '#E5A33B', '#F2EEE8', '#F0663C']

export function fireConfetti(durationMs = 2600) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  interface P { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string; rot: number; vr: number }
  const parts: P[] = Array.from({ length: 160 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.35,
    y: canvas.height * 0.28,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 10,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }))

  const t0 = performance.now()
  const frame = (t: number) => {
    const elapsed = t - t0
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of parts) {
      p.vy += 0.32
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.99
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.max(0, 1 - elapsed / durationMs)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (elapsed < durationMs) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
