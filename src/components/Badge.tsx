const colors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)', border: 'var(--color-gray-300)' },
  running: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', border: '#bfdbfe' },
  paused: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', border: '#fde68a' },
  completed: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', border: '#a7f3d0' },
  failed: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)', border: '#fecaca' },
}

const icons: Record<string, string> = {
  pending: '○',
  running: '◉',
  paused: '⏸',
  completed: '✓',
  failed: '✕',
}

export default function Badge({ status }: { status: string }) {
  const c = colors[status] || colors.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '2px 10px', borderRadius: '12px',
      backgroundColor: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      fontSize: '12px', fontWeight: '600',
      textTransform: 'capitalize'
    }}>
      <span style={{ fontSize: '10px' }}>{icons[status] || '○'}</span>
      {status}
    </span>
  )
}
