import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { event, table, trigger } = req.body

    console.log('Event received:', {
      trigger: trigger?.name,
      table: table?.name,
      operation: event?.op,
      data: event?.data
    })

    if (trigger?.name === 'notify_on_completion' && event?.data?.new?.status === 'completed') {
      console.log('Step completed notification:', event.data.new.id)
    }

    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Event handler error:', error)
    return res.status(500).json({ error: error.message })
  }
}
