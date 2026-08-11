import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

interface LayoutProps {
  children: React.ReactNode
  showNav?: boolean
}

export default function Layout({ children, showNav = true }: LayoutProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')

  useEffect(() => {
    setEmail(localStorage.getItem('user_email') || '')
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('nhost_jwt_token')
    localStorage.removeItem('user_email')
    localStorage.removeItem('user_id')
    router.push('/login')
  }

  if (!showNav) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--color-gray-200)',
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            onClick={() => router.push('/workflows')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: '700', fontSize: '16px'
            }}>W</div>
            <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--color-gray-900)' }}>
              Workflow Builder
            </span>
          </div>
          <nav style={{ display: 'flex', gap: '4px' }}>
            {[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Workflows', path: '/workflows' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: router.pathname.startsWith(item.path) ? 'var(--color-gray-100)' : 'transparent',
                  color: router.pathname.startsWith(item.path) ? 'var(--color-primary)' : 'var(--color-gray-600)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>{email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px',
              backgroundColor: 'transparent',
              color: 'var(--color-gray-600)',
              border: '1px solid var(--color-gray-300)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
