const stepConfig: Record<string, { icon: string; color: string; label: string }> = {
  llm_call: { icon: '🤖', color: '#8b5cf6', label: 'LLM Call' },
  http_request: { icon: '🌐', color: '#0ea5e9', label: 'HTTP Request' },
  db_write: { icon: '💾', color: '#059669', label: 'DB Write' },
  notify: { icon: '🔔', color: '#d97706', label: 'Notify' },
  conditional_branch: { icon: '🔀', color: '#e11d48', label: 'Condition' },
  approval_gate: { icon: '✋', color: '#f59e0b', label: 'Approval Gate' },
}

export default function StepIcon({ type, size = 28 }: { type: string; size?: number }) {
  const s = stepConfig[type] || { icon: '●', color: '#6b7280', label: type }
  return (
    <div style={{
      width: size, height: size, borderRadius: '8px',
      backgroundColor: s.color + '15',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, flexShrink: 0
    }}>
      {s.icon}
    </div>
  )
}

export function stepLabel(type: string) {
  return stepConfig[type]?.label || type
}

export function stepColor(type: string) {
  return stepConfig[type]?.color || '#6b7280'
}
