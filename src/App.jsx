import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import Leaderboard from './pages/Leaderboard.jsx'
import Admin from './pages/Admin'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })
      if (error) setMessage(error.message)
      else setMessage('Revisa tu email para confirmar tu cuenta')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h2 style={{ textAlign: 'center' }}>🏆 Porra Mundial 2026</h2>
      <div style={{ background: '#f9f9f9', padding: '32px', borderRadius: '12px', border: '1px solid #eee' }}>
        <h3 style={{ margin: '0 0 24px', textAlign: 'center' }}>{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
        
        {!isLogin && (
          <input
            type="text"
            placeholder="Nombre completo"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
        />
        
        {message && (
          <div style={{ padding: '10px', marginBottom: '16px', background: '#fff3cd', borderRadius: '6px', fontSize: '14px', color: '#856404' }}>
            {message}
          </div>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear cuenta'}
        </button>
        
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#666' }}>
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <span onClick={() => setIsLogin(!isLogin)} style={{ color: '#2d6a4f', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLogin ? 'Regístrate' : 'Inicia sesión'}
          </span>
        </p>
      </div>
    </div>
  )
}

const navStyle = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  padding: '12px 24px',
  background: '#2d6a4f',
  fontFamily: 'sans-serif'
}

const linkStyle = {
  color: 'rgba(255,255,255,0.7)',
  textDecoration: 'none',
  fontSize: '15px',
  padding: '6px 12px',
  borderRadius: '6px'
}

const activeLinkStyle = {
  color: 'white',
  background: 'rgba(255,255,255,0.15)'
}

function AppLayout({ session }) {
  return (
    <div>
      <nav style={navStyle}>
        <span style={{ color: 'white', fontWeight: 'bold', marginRight: 'auto' }}>🏆 Porra Mundial 2026</span>
        <NavLink to="/" end style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}>
          Dashboard
        </NavLink>
        <NavLink to="/leaderboard" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}>
          Clasificación
        </NavLink>
        <NavLink to="/admin" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeLinkStyle : {}) })}>
          Admin
        </NavLink>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}
        >
          Salir
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard session={session} />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/admin" element={<Admin session={session} />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>

  if (!session) return <Auth />

  return (
    <BrowserRouter>
      <AppLayout session={session} />
    </BrowserRouter>
  )
}