import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem('nhost_jwt_token')
    router.push(token ? '/dashboard' : '/login')
  }, [router])
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
}
