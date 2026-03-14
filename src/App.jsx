import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import Predictions from './pages/Predictions'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import PaymentWall from './components/PaymentWall'
import { useCountdown, WORLD_CUP_START } from './hooks/useCountdown'

/* ============================
   PANTALLA DE LOGIN / REGISTRO
   ============================ */
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
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg-primary)'
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', letterSpacing: '1.5px' }}>
            PORRA MUNDIAL <span style={{ color: 'var(--gold)' }}>26</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            La porra del Mundial 2026
          </div>
        </div>

        {/* Formulario */}
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '28px 24px',
          borderRadius: '10px',
          border: '0.5px solid var(--border)'
        }}>
          <h3 style={{
            margin: '0 0 20px',
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </h3>

          {!isLogin && (
            <input
              type="text"
              placeholder="Nombre completo"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: '20px' }}
          />

          {message && (
            <div style={{
              padding: '10px 12px',
              marginBottom: '16px',
              background: message.includes('Revisa') ? 'var(--green-light)' : 'var(--red-bg)',
              borderRadius: '6px',
              fontSize: '13px',
              color: message.includes('Revisa') ? 'var(--green)' : 'var(--red)'
            }}>
              {message}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear cuenta'}
          </button>

          <p style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}>
            {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <span
              onClick={() => { setIsLogin(!isLogin); setMessage('') }}
              style={{ color: 'var(--green)', cursor: 'pointer', fontWeight: '600' }}
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  marginBottom: '12px',
  borderRadius: '6px',
  border: '0.5px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  boxSizing: 'border-box'
}

/* ============================
   NAVBAR + LAYOUT PRINCIPAL
   ============================ */
function Navbar({ isAdmin }) {
  const countdown = useCountdown(WORLD_CUP_START)

  return (
    <nav style={{
      background: 'var(--bg-nav)',
      borderBottom: '2px solid var(--green)',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '48px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Logo */}
      <NavLink to="/" style={{ textDecoration: 'none' }}>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '1.2px' }}>
          PORRA MUNDIAL <span style={{ color: 'var(--gold)' }}>26</span>
        </span>
      </NavLink>

      {/* Countdown centrado absoluto */}
      {!countdown.expired && (
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'linear-gradient(135deg, rgba(107,24,42,0.5), rgba(74,21,32,0.5))',
          padding: '4px 12px',
          borderRadius: '4px',
          border: '0.5px solid rgba(160,60,80,0.25)'
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,180,180,0.5)' }}>⏱</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#ff8a8a',
            letterSpacing: '0.5px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {countdown.days}d {String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m
          </span>
        </div>
      )}

      {/* Links */}
      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        <StyledNavLink to="/" end>Inicio</StyledNavLink>
        <StyledNavLink to="/predictions">Predicciones</StyledNavLink>
        <StyledNavLink to="/leaderboard">Ranking</StyledNavLink>
        {isAdmin && <StyledNavLink to="/admin">Admin</StyledNavLink>}
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '7px 12px',
            marginLeft: '4px'
          }}
        >
          Salir
        </button>
      </div>
    </nav>
  )
}

function StyledNavLink({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        padding: '7px 14px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: isActive ? '600' : '400',
        color: isActive ? '#fff' : 'var(--text-muted)',
        background: isActive ? 'var(--green)' : 'transparent',
        textDecoration: 'none',
        letterSpacing: '0.3px'
      })}
    >
      {children}
    </NavLink>
  )
}

function AppLayout({ session }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasPaid, setHasPaid] = useState(null) // null = cargando

  useEffect(() => {
    async function checkProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin, has_paid')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setIsAdmin(!!data.is_admin)
        setHasPaid(!!data.has_paid)
      }
    }
    checkProfile()
  }, [session.user.id])

  // Mientras carga el perfil, mostrar loading
  if (hasPaid === null) {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px'
      }}>
        Cargando...
      </div>
    )
  }

  return (
    <div>
      {/* Si no ha pagado, mostrar el popup de pago encima de todo */}
      {!hasPaid && <PaymentWall />}

      <Navbar isAdmin={isAdmin} />
      <Routes>
        <Route path="/" element={<Dashboard session={session} />} />
        <Route path="/predictions" element={<Predictions session={session} />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        {isAdmin && <Route path="/admin" element={<Admin session={session} />} />}
      </Routes>
    </div>
  )
}

/* ============================
   APP PRINCIPAL
   ============================ */
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '14px'
      }}>
        Cargando...
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <BrowserRouter>
      <AppLayout session={session} />
    </BrowserRouter>
  )
}