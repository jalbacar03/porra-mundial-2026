import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (!session) {
    return <Auth />
  }

  return <Home session={session} />
}

function Auth() {
  const [modo, setModo] = useState('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o contraseña incorrectos')
  }

  const handleRegistro = async () => {
    setError('')
    setMensaje('')
    if (!nombre) return setError('Escribe tu nombre')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } }
    })
    if (error) setError(error.message)
    else setMensaje('¡Registro completado! Revisa tu email para confirmar la cuenta.')
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h2>Porra Mundial 2026</h2>

      {modo === 'login' ? (
        <>
          <input
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button onClick={handleLogin} style={{ padding: '8px 16px' }}>
            Entrar
          </button>
          <p style={{ marginTop: 16 }}>
            ¿No tienes cuenta?{' '}
            <span onClick={() => { setModo('registro'); setError('') }} style={{ color: 'blue', cursor: 'pointer' }}>
              Regístrate
            </span>
          </p>
        </>
      ) : (
        <>
          <input
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {mensaje && <p style={{ color: 'green' }}>{mensaje}</p>}
          <button onClick={handleRegistro} style={{ padding: '8px 16px' }}>
            Crear cuenta
          </button>
          <p style={{ marginTop: 16 }}>
            ¿Ya tienes cuenta?{' '}
            <span onClick={() => { setModo('login'); setError('') }} style={{ color: 'blue', cursor: 'pointer' }}>
              Inicia sesión
            </span>
          </p>
        </>
      )}
    </div>
  )
}

function Home({ session }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h2>¡Bienvenido!</h2>
      <p>Logged in como: {session.user.email}</p>
      <button onClick={handleLogout} style={{ padding: '8px 16px' }}>
        Cerrar sesión
      </button>
    </div>
  )
}

export default App