import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import './App.css'
import Dashboard from './pages/Dashboard'
import Predictions from './pages/Predictions/PredictionsPage'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import Stats from './pages/Stats'
import Rules from './pages/Rules'
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
   ICONOS SVG PARA BOTTOM NAV
   ============================ */
function IconHome({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function IconPredictions({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}
function IconRanking({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
function IconStats({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  )
}
function IconRules({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
function IconAdmin({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconLogout({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

/* ============================
   NAVBAR + LAYOUT PRINCIPAL
   ============================ */
function TopNavbar({ isAdmin }) {
  const countdown = useCountdown(WORLD_CUP_START)

  return (
    <nav className="top-navbar" style={{
      background: 'var(--bg-nav)',
      borderBottom: '2px solid var(--green)',
      padding: '0 16px',
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
        <StyledNavLink to="/predictions">Mis predicciones</StyledNavLink>
        <StyledNavLink to="/leaderboard">Clasificación</StyledNavLink>
        <StyledNavLink to="/stats">Stats</StyledNavLink>
        <StyledNavLink to="/rules">Normas</StyledNavLink>
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

function BottomNavbar({ isAdmin }) {
  const location = useLocation()

  const navItems = [
    { to: '/', label: 'Inicio', icon: IconHome, end: true },
    { to: '/predictions', label: 'Mis pred.', icon: IconPredictions },
    { to: '/leaderboard', label: 'Clasif.', icon: IconRanking },
    { to: '/stats', label: 'Stats', icon: IconStats },
    { to: '/rules', label: 'Normas', icon: IconRules },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: IconAdmin }] : []),
    { to: null, label: 'Salir', icon: IconLogout, action: () => supabase.auth.signOut() }
  ]

  return (
    <nav className="bottom-navbar" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      minHeight: '60px',
      background: 'var(--bg-nav)',
      borderTop: '1px solid var(--border)',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 100
    }}>
      {navItems.map((item, i) => {
        const isActive = item.to !== null && (
          item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
        )
        const Icon = item.icon

        if (item.action) {
          return (
            <button
              key={i}
              onClick={item.action}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '6px 12px',
                cursor: 'pointer',
                color: 'var(--text-dim)'
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: '10px', letterSpacing: '0.3px' }}>{item.label}</span>
            </button>
          )
        }

        return (
          <NavLink
            key={i}
            to={item.to}
            end={item.end}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '6px 12px',
              textDecoration: 'none',
              color: isActive ? 'var(--green)' : 'var(--text-dim)'
            }}
          >
            <Icon size={20} />
            <span style={{
              fontSize: '10px',
              fontWeight: isActive ? '600' : '400',
              letterSpacing: '0.3px'
            }}>
              {item.label}
            </span>
          </NavLink>
        )
      })}
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

      <TopNavbar isAdmin={isAdmin} />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/predictions" element={<Predictions session={session} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/rules" element={<Rules />} />
          {isAdmin && <Route path="/admin" element={<Admin session={session} />} />}
        </Routes>
      </div>
      <BottomNavbar isAdmin={isAdmin} />
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