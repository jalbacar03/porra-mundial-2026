import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Predictions from './Predictions'

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [currentPage, setCurrentPage] = useState('home')

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!error) setProfile(data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  // Si estamos en la página de predicciones, mostrar ese componente
  if (currentPage === 'predictions') {
    return (
      <div style={{ fontFamily: 'sans-serif' }}>
        {/* Barra de navegación */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: '#2d6a4f',
          color: 'white'
        }}>
          <button
            onClick={() => setCurrentPage('home')}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.4)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Inicio
          </button>
          <span style={{ fontWeight: 'bold' }}>🏆 Porra Mundial 2026</span>
          <div style={{ width: '80px' }}></div>
        </div>
        <Predictions session={session} />
      </div>
    )
  }

  // Página principal (home)
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>

      {/* Cabecera */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 4px' }}>🏆 Porra Mundial 2026</h1>
        <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
          Hola, {profile?.full_name || session.user.email}
        </p>
        {profile && (
          <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 'bold', color: '#2d6a4f' }}>
            🪙 {profile.chips} fichas disponibles
          </div>
        )}
      </div>

      {/* Menú de opciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Botón predicciones */}
        <button
          onClick={() => setCurrentPage('predictions')}
          style={{
            padding: '20px',
            background: '#2d6a4f',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '16px'
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>⚽ Mis Predicciones</div>
          <div style={{ fontSize: '14px', opacity: 0.85 }}>Introduce tus resultados para la fase de grupos</div>
        </button>

        {/* Botón clasificación (próximamente) */}
        <button
          disabled
          style={{
            padding: '20px',
            background: '#f0f0f0',
            color: '#999',
            border: '1px solid #ddd',
            borderRadius: '12px',
            textAlign: 'left',
            fontSize: '16px',
            cursor: 'not-allowed'
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>📊 Clasificación</div>
          <div style={{ fontSize: '14px' }}>Próximamente</div>
        </button>

        {/* Botón retos especiales (próximamente) */}
        <button
          disabled
          style={{
            padding: '20px',
            background: '#f0f0f0',
            color: '#999',
            border: '1px solid #ddd',
            borderRadius: '12px',
            textAlign: 'left',
            fontSize: '16px',
            cursor: 'not-allowed'
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>🎯 Retos Especiales</div>
          <div style={{ fontSize: '14px' }}>Próximamente</div>
        </button>
      </div>

      {/* Cerrar sesión */}
      <button
        onClick={handleLogout}
        style={{
          width: '100%',
          marginTop: '32px',
          padding: '12px',
          background: 'none',
          border: '1px solid #ddd',
          borderRadius: '8px',
          color: '#999',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}