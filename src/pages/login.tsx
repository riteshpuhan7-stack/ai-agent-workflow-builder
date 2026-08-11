import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true)
    localStorage.setItem('nhost_jwt_token', 'mock-token')
    localStorage.setItem('user_email', email)
    localStorage.setItem('user_id', 'user-1')
    setTimeout(() => router.push('/dashboard'), 300)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        backgroundColor: 'white', borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        padding: '40px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: '22px',
            margin: '0 auto 16px'
          }}>W</div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
            Welcome back
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-gray-500)' }}>
            Sign in to your workflow builder
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--color-gray-700)' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--color-gray-300)',
                borderRadius: '8px', fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--color-gray-700)' }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Any password works in demo"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--color-gray-300)',
                borderRadius: '8px', fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '10px 16px',
              backgroundColor: loading ? 'var(--color-gray-400)' : 'var(--color-primary)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '600', cursor: loading ? 'default' : 'pointer'
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '10px 12px', backgroundColor: 'var(--color-info-bg)', borderRadius: '8px', fontSize: '12px', color: 'var(--color-info)', textAlign: 'center' }}>
          Demo mode — use any email and password
        </div>
      </div>
    </div>
  )
}
