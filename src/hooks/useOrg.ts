import { useState, useEffect } from 'react'
import { getGraphQLClient } from '@/lib/graphql-client'

interface OrgData {
  orgId: string
  orgName: string
  role: string
  monthlyQuota: number
  monthlyUsed: number
}

export function useOrg() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrg()
  }, [])

  const loadOrg = async () => {
    try {
      const client = getGraphQLClient()
      const data: any = await client.request(`
        query {
          org_members(limit: 1) {
            org_id
            role
            organization {
              id
              name
              monthly_quota
              monthly_used
            }
          }
        }
      `)

      const member = data.org_members?.[0]
      if (member) {
        setOrg({
          orgId: member.org_id,
          orgName: member.organization.name,
          role: member.role,
          monthlyQuota: member.organization.monthly_quota,
          monthlyUsed: member.organization.monthly_used,
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { org, loading, error, refetch: loadOrg }
}
