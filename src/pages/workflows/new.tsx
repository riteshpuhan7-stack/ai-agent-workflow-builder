import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import StepIcon, { stepLabel, stepColor } from '@/components/StepIcon'
import { useOrg } from '@/hooks/useOrg'
import { getGraphQLClient } from '@/lib/graphql-client'

const stepTypes = [
  { value: 'llm_call', label: 'LLM Call', desc: 'Call an AI model with a prompt' },
  { value: 'http_request', label: 'HTTP Request', desc: 'Make an external API call' },
  { value: 'conditional_branch', label: 'Conditional Branch', desc: 'Branch based on a condition' },
  { value: 'approval_gate', label: 'Approval Gate', desc: 'Pause for manual approval' },
  { value: 'notify', label: 'Notify', desc: 'Send a notification (owner only)' },
  { value: 'db_write', label: 'DB Write', desc: 'Write data to database (owner only)' },
]

const defaultConfigs: Record<string, string> = {
  llm_call: JSON.stringify({ prompt: 'What is AI?' }, null, 2),
  http_request: JSON.stringify({ url: 'https://httpbin.org/get', method: 'GET' }, null, 2),
  conditional_branch: JSON.stringify({ condition: 'contains', value: 'intelligence' }, null, 2),
  approval_gate: JSON.stringify({ message: 'Please approve to continue' }, null, 2),
  db_write: JSON.stringify({ table: 'logs', data: {} }, null, 2),
  notify: JSON.stringify({ channel: 'general', message: 'Step completed' }, null, 2),
}

export default function CreateWorkflow() {
  const router = useRouter()
  const { org, loading: orgLoading } = useOrg()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<Array<{ type: string; config: any; position: number }>>([])
  const [triggers, setTriggers] = useState<Array<{ type: string }>>([{ type: 'manual' }])
  const [stepType, setStepType] = useState('llm_call')
  const [stepConfig, setStepConfig] = useState(defaultConfigs.llm_call)
  const [configError, setConfigError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('nhost_jwt_token')) { router.push('/login') }
  }, [router])

  const handleTypeChange = (type: string) => {
    setStepType(type)
    setStepConfig(defaultConfigs[type] || '{}')
    setConfigError('')
  }

  const handleAddStep = () => {
    try {
      const config = JSON.parse(stepConfig.trim())
      setSteps(prev => [...prev, { type: stepType, config, position: prev.length }])
      setStepType('llm_call')
      setStepConfig(defaultConfigs.llm_call)
      setConfigError('')
    } catch {
      setConfigError('Invalid JSON. Check your config syntax.')
    }
  }

  const handleRemoveStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i })))
  }

  const handleMoveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= steps.length) return
    const arr = [...steps]
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    setSteps(arr.map((s, i) => ({ ...s, position: i })))
  }

  const handleSave = async () => {
    if (!name.trim()) { alert('Workflow name is required'); return }
    if (steps.length === 0) { alert('Add at least one step'); return }
    setSaving(true)
    try {
      const client = getGraphQLClient()
      const data: any = await client.request(`
        mutation CreateWorkflow($data: workflows_insert_input!) {
          insert_workflows_one(object: $data) { id }
        }
      `, {
        data: {
          org_id: org!.orgId,
          name: name.trim(),
          description: description.trim() || null,
          workflow_steps: { data: steps },
          workflow_triggers: { data: triggers.length > 0 ? triggers : [{ type: 'manual' }] },
        }
      })
      router.push(`/workflows/${data.insert_workflows_one.id}`)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (orgLoading) {
    return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Loading...</div></Layout>
  }

  if (org && org.role !== 'owner' && org.role !== 'editor') {
    return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-danger)' }}>You don't have permission to create workflows</div></Layout>
  }

  return (
    <Layout>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => router.push('/workflows')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '8px' }}>
          ← Back to Workflows
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Create Workflow</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* Left: Steps */}
        <div>
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)', marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Workflow Steps ({steps.length})</h2>

            {steps.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'var(--color-gray-50)', borderRadius: '8px', color: 'var(--color-gray-400)', fontSize: '14px' }}>
                No steps added yet. Configure a step on the right and click "Add Step".
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', backgroundColor: 'var(--color-gray-50)',
                    borderRadius: '8px', border: '1px solid var(--color-gray-200)'
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-gray-400)', fontWeight: '600', width: '20px', textAlign: 'center' }}>{i + 1}</span>
                    <StepIcon type={step.type} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: stepColor(step.type) }}>{stepLabel(step.type)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(step.config).substring(0, 80)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleMoveStep(i, -1)} disabled={i === 0} style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: i === 0 ? 'default' : 'pointer', fontSize: '12px', color: i === 0 ? 'var(--color-gray-300)' : 'var(--color-gray-600)' }}>↑</button>
                      <button onClick={() => handleMoveStep(i, 1)} disabled={i === steps.length - 1} style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: i === steps.length - 1 ? 'default' : 'pointer', fontSize: '12px', color: i === steps.length - 1 ? 'var(--color-gray-300)' : 'var(--color-gray-600)' }}>↓</button>
                      <button onClick={() => handleRemoveStep(i)} style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-danger)' }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Triggers */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '600' }}>Triggers</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {triggers.map((t, i) => (
                <span key={i} style={{
                  padding: '6px 12px', backgroundColor: 'var(--color-info-bg)',
                  borderRadius: '16px', fontSize: '13px', fontWeight: '500',
                  color: 'var(--color-info)', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  Manual trigger
                  <button onClick={() => setTriggers(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-info)', fontSize: '14px' }}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Config panel */}
        <div style={{ display: 'grid', gap: '16px', position: 'sticky', top: '84px' }}>
          {/* Name & Description */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Details</h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: 'var(--color-gray-700)' }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer Support Agent"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-gray-300)', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: 'var(--color-gray-700)' }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this workflow do?"
                rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-gray-300)', borderRadius: '6px', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>

          {/* Add Step */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Add Step</h2>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: 'var(--color-gray-700)' }}>Type</label>
              <select value={stepType} onChange={e => handleTypeChange(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-gray-300)', borderRadius: '6px', fontSize: '14px' }}>
                {stepTypes.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
              <div style={{ fontSize: '12px', color: 'var(--color-gray-400)', marginTop: '4px' }}>
                {stepTypes.find(st => st.value === stepType)?.desc}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: 'var(--color-gray-700)' }}>Configuration (JSON)</label>
              <textarea value={stepConfig} onChange={e => { setStepConfig(e.target.value); setConfigError('') }}
                style={{ width: '100%', padding: '8px 12px', border: `1px solid ${configError ? 'var(--color-danger)' : 'var(--color-gray-300)'}`,
                  borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', minHeight: '120px', resize: 'vertical' }} />
              {configError && <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '4px' }}>{configError}</div>}
            </div>

            <button onClick={handleAddStep}
              style={{
                width: '100%', padding: '10px', backgroundColor: 'var(--color-success)',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}>
              Add Step
            </button>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '12px', backgroundColor: saving ? 'var(--color-gray-400)' : 'var(--color-primary)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '600', cursor: saving ? 'default' : 'pointer'
            }}>
            {saving ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
