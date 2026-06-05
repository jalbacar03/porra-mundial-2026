import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import './App.css'
import { ToastProvider } from './components/Toast'
import { SkeletonDashboard, FootballSpinner } from './components/Skeleton'
import ErrorBoundary from './components/ErrorBoundary'
import PageTransition from './components/PageTransition'
import Onboarding from './components/Onboarding'

// Code splitting — lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Predictions = lazy(() => import('./pages/Predictions/PredictionsPage'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Admin = lazy(() => import('./pages/Admin'))
const Stats = lazy(() => import('./pages/Stats'))
const Rules = lazy(() => import('./pages/Rules'))
const News = lazy(() => import('./pages/News'))
const Forum = lazy(() => import('./pages/Forum'))
const Announcements = lazy(() => import('./pages/Announcements'))
const MatchDayLive = lazy(() => import('./pages/MatchDayLive'))
const MatchDetail = lazy(() => import('./pages/MatchDetail'))
const PreMundial = lazy(() => import('./pages/PreMundial'))

import PaymentWall from './components/PaymentWall'
import RulesPopup from './components/RulesPopup'
import NicknameModal from './components/NicknameModal'
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
      // Identification rule: nombre + apellido reales obligatorios para poder
      // entregar premio si gana. Sin nickname — se accede e identifica solo
      // por nombre real.
      const trimmedName = fullName.trim().replace(/\s+/g, ' ')
      const words = trimmedName.split(' ').filter(Boolean)
      if (words.length < 2 || words.some(w => w.length < 2)) {
        setMessage('Indica tu nombre y apellido reales (mínimo 2 palabras). Es necesario para identificarte si ganas el premio.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: trimmedName } }
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
            <>
              <input
                type="text"
                placeholder="Nombre y apellido reales *"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={inputStyle}
                required
              />
              <div style={{
                fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: '1.45',
                marginTop: '-6px', marginBottom: '10px', padding: '0 2px'
              }}>
                Imprescindible para identificarte si ganas el premio. Aparecerás en la clasificación con tu nombre y apellido.
              </div>
            </>
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
function IconNews({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <line x1="10" y1="6" x2="18" y2="6" />
      <line x1="10" y1="10" x2="18" y2="10" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  )
}
function IconForum({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
function IconLive({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
  )
}
function IconMegaphone({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
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
   PAGE LOADER (Suspense fallback)
   ============================ */
function PageLoader() {
  return (
    <div style={{
      padding: '24px 16px',
      animation: 'fadeIn 0.2s ease',
    }}>
      <SkeletonDashboard />
    </div>
  )
}

/* ============================
   NAVBAR + LAYOUT PRINCIPAL
   ============================ */
function TopNavbar({ isAdmin, demoMode }) {
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
      {/* Logo + Countdown wrapper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <NavLink to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '1.2px' }}>
            PORRA MUNDIAL <span style={{ color: 'var(--gold)' }}>26</span>
          </span>
        </NavLink>

        {demoMode ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, rgba(0,122,69,0.3), rgba(0,94,58,0.3))',
            padding: '4px 12px',
            borderRadius: '4px',
            border: '0.5px solid rgba(0,122,69,0.25)'
          }}>
            <span style={{ fontSize: '10px' }}>⚽</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#4ade80',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              DÍA 4
            </span>
          </div>
        ) : !countdown.expired ? (
          <div style={{
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
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, rgba(0,122,69,0.3), rgba(0,94,58,0.3))',
            padding: '4px 12px',
            borderRadius: '4px',
            border: '0.5px solid rgba(0,122,69,0.25)'
          }}>
            <span style={{ fontSize: '10px' }}>⚽</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#4ade80',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              DÍA {Math.floor((Date.now() - WORLD_CUP_START.getTime()) / 86400000) + 1}
            </span>
          </div>
        )}
      </div>

      {/* Links */}
      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        <StyledNavLink to="/" end>Inicio</StyledNavLink>
        <StyledNavLink to="/predictions">Mis predicciones</StyledNavLink>
        <StyledNavLink to="/leaderboard">Clasificación</StyledNavLink>
        <StyledNavLink to="/stats">Estadísticas</StyledNavLink>
        <StyledNavLink to="/news">Noticias</StyledNavLink>
        <StyledNavLink to="/announcements">Avisos</StyledNavLink>
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
            marginLeft: '2px'
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

  // Barra idéntica para TODOS (incl. admin). Etiquetas cortas para que entren
  // 6 ítems en una línea en móviles pequeños. El acceso a Admin ya NO está
  // aquí: vive como engranaje en la cabecera de Inicio (solo admins).
  // Normas sigue en el footer discreto (MobileFooterLinks).
  const navItems = [
    { to: '/', label: 'Inicio', icon: IconHome, end: true },
    { to: '/predictions', label: 'Predicciones', icon: IconPredictions },
    { to: '/leaderboard', label: 'Clasificación', icon: IconRanking },
    { to: '/stats', label: 'Stats', icon: IconStats },
    { to: '/news', label: 'Noticias', icon: IconNews },
    { to: '/announcements', label: 'Avisos', icon: IconMegaphone },
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

        return (
          <NavLink
            key={i}
            to={item.to}
            end={item.end}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '6px 4px',
              flex: 1,
              minWidth: 0,
              textDecoration: 'none',
              color: isActive ? 'var(--green)' : 'var(--text-dim)'
            }}
          >
            <Icon size={20} />
            <span style={{
              fontSize: '9px',
              fontWeight: isActive ? '600' : '400',
              letterSpacing: '0.1px',
              textAlign: 'center',
              lineHeight: '1.1',
              // Palabras largas de una sola pieza ("Clasificación",
              // "Predicciones") parten a 2 líneas en vez de desbordar.
              maxWidth: '100%',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              hyphens: 'auto'
            }}>
              {item.label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function MobileFooterLinks() {
  // Discreet bottom-of-page footer (mobile only — .mobile-rules-footer is
  // display:none on desktop, where Normas is in the top-nav and "Salir" sits
  // by the logo). Holds the two low-traffic actions that aren't in the bottom
  // bar: Normas (hidden from the bar but still reachable here; "atrás"
  // returns to the previous screen) and logout (rare + destructive, kept
  // low-contrast so it's not a mistap magnet).
  const linkStyle = {
    fontSize: '11px',
    color: 'var(--text-dim)',
    textDecoration: 'none',
    cursor: 'pointer',
    letterSpacing: '0.3px',
    padding: '8px 16px',
    borderRadius: '20px',
    border: '0.5px solid var(--border)',
    background: 'var(--bg-secondary)',
    transition: 'all 0.2s ease'
  }
  return (
    <div className="mobile-rules-footer" style={{ padding: '24px 16px 100px' }}>
      {/* inner flex row — the outer div keeps the CSS display:block/none
          toggle (which has !important), so the row lives one level in */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <NavLink to="/rules" style={linkStyle}>Normas del torneo</NavLink>
        <button onClick={() => supabase.auth.signOut()} style={linkStyle}>
          Cerrar sesión
        </button>
      </div>
    </div>
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
  const [rulesAccepted, setRulesAccepted] = useState(null) // null = cargando
  const [profile, setProfile] = useState(null)
  // Demo mode removed from the admin UI (no toggle). Hard-off so all the
  // demoMode={demoMode} props downstream simply render real data.
  const demoMode = false

  useEffect(() => {
    async function checkProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin, has_paid, rules_accepted, onboarding_seen_at, access_requested_at, full_name')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setProfile(data)
        setIsAdmin(!!data.is_admin)
        setHasPaid(!!data.has_paid)
        setRulesAccepted(!!data.rules_accepted)
      }
    }
    checkProfile()
  }, [session.user.id])

  // Mientras carga el perfil, mostrar loading
  if (hasPaid === null) {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <FootballSpinner size={36} text="Cargando…" />
      </div>
    )
  }

  return (
    <div>
      {/* Si no está admitido, mostrar popup de inscripción */}
      {!hasPaid && <PaymentWall session={session} profile={profile} />}

      {/* Onboarding para nuevos usuarios */}
      {hasPaid && rulesAccepted && <Onboarding session={session} profile={profile} />}

      {/* Si ha pagado pero no ha aceptado normas, mostrar popup de normas */}
      {hasPaid && !rulesAccepted && (
        <RulesPopup
          userId={session.user.id}
          onAccepted={() => setRulesAccepted(true)}
        />
      )}

      {/* Nickname obligatorio — modal bloqueante si el user aún no eligió uno.
          Aparece tras admisión + normas, antes de poder hacer nada en la app. */}
      {hasPaid && rulesAccepted && (
        <NicknameModal
          session={session}
          onSaved={(nick) => setProfile(p => p ? { ...p, nickname: nick } : p)}
        />
      )}

      <TopNavbar isAdmin={isAdmin} demoMode={demoMode} />

      <div className="app-content">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <PageTransition>
              <Routes>
                <Route path="/" element={<Dashboard session={session} demoMode={demoMode} />} />
                <Route path="/predictions" element={<Predictions session={session} demoMode={demoMode} />} />
                <Route path="/match/:id" element={<MatchDetail session={session} />} />
              <Route path="/pre-mundial" element={<PreMundial session={session} />} />
                <Route path="/leaderboard" element={<Leaderboard demoMode={demoMode} />} />
                <Route path="/stats" element={<Stats demoMode={demoMode} />} />
                <Route path="/matchday" element={<MatchDayLive session={session} />} />
                <Route path="/news" element={<News />} />
                <Route path="/announcements" element={<Announcements session={session} isAdmin={isAdmin} />} />
                <Route path="/forum" element={<Forum session={session} />} />
                <Route path="/rules" element={<Rules />} />
                {isAdmin && <Route path="/admin" element={<Admin session={session} />} />}
              </Routes>
            </PageTransition>
          </Suspense>
        </ErrorBoundary>
        <MobileFooterLinks />
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
        justifyContent: 'center'
      }}>
        <FootballSpinner size={36} />
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <BrowserRouter>
      <ToastProvider>
        <AppLayout session={session} />
      </ToastProvider>
    </BrowserRouter>
  )
}