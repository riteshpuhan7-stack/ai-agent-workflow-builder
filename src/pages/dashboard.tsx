import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import { useOrg } from '@/hooks/useOrg'
import { getGraphQLClient } from '@/lib/graphql-client'

export default function Dashboard() {
  const router = useRouter()
  const { org, loading: orgLoading } = useOrg()
  const [stats, setStats] = useState({ total: 0, running: 0, completed: 0, failed: 0 })
  const [recentRuns, setRecentRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('nhost_jwt_token')) { router.push('/login'); return }
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      const client = getGraphQLClient()
      const wfData: any = await client.request(`
        query {
          workflows(order_by: { updated_at: desc }, limit: 5) {
            id name description updated_at
            workflow_steps { id }
          }
        }
      `)

      const total = wfData.workflows?.length || 0

      const runData: any = await client.request(`
        query {
          workflow_runs(order_by: { started_at: desc }, limit: 10) {
            id status started_at completed_at
            workflow { name }
          }
        }
      `)

      const runs = runData.workflow_runs || []
      const running = runs.filter((r: any) => r.status === 'running').length
      const completed = runs.filter((r: any) => r.status === 'completed').length
      const failed = runs.filter((r: any) => r.status === 'failed').length

      setStats({ total, running, completed, failed })
      setRecentRuns(runs.slice(0, 5))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (orgLoading || loading) {
    return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Loading dashboard...</div></Layout>
  }

  const quotaPercent = org ? Math.min((org.monthlyUsed / org.monthlyQuota) * 100, 100) : 0

  return (
    <Layout>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700' }}>Dashboard</h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-gray-500)' }}>
          {org?.orgName || 'No organization'} — {org?.role || 'viewer'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Workflows', value: stats.total, color: 'var(--color-primary)', bg: '#eef2ff' },
          { label: 'Running', value: stats.running, color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
          { label: 'Completed', value: stats.completed, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          { label: 'Failed', value: stats.failed, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
        ].map(card => (
          <div key={card.label} style={{
            padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)',
            border: '1px solid var(--color-gray-200)', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{
          padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)',
          border: '1px solid var(--color-gray-200)', boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>Monthly Usage</h3>
          {org ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: 'var(--color-gray-600)' }}>{org.monthlyUsed} used</span>
                <span style={{ color: 'var(--color-gray-500)' }}>{org.monthlyQuota} limit</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  backgroundColor: quotaPercent > 80 ? 'var(--color-danger)' : quotaPercent > 50 ? 'var(--color-warning)' : 'var(--color-primary)',
                  width: `${quotaPercent}%`, transition: 'width 0.3s'
                }} />
              </div>
              {quotaPercent >= 80 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-warning)' }}>
                  Approaching quota limit
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--color-gray-400)', fontSize: '14px' }}>No organization data</div>
          )}
        </div>

        <div style={{
          padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)',
          border: '1px solid var(--color-gray-200)', boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>Recent Runs</h3>
          {recentRuns.length === 0 ? (
            <div style={{ color: 'var(--color-gray-400)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              No runs yet. Create and run a workflow to see activity here.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {recentRuns.map(run => (
                <div key={run.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', backgroundColor: 'var(--color-gray-50)', borderRadius: '6px',
                  cursor: 'pointer'
                }} onClick={() => router.push(`/workflows/${run.workflow_id}/runs/${run.id}`)}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{run.workflow?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-gray-400)' }}>
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge status={run.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
