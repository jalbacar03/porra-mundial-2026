import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { defaultNickname, validateNickname } from '../utils/nickname'

/**
 * Modal bloqueante que aparece cuando un user logueado todavía no ha elegido
 * nickname. No se puede cerrar sin guardar. Una vez guardado, el modal se
 * desmonta y el resto de la app sigue su curso.
 *
 * Lógica:
 *   - mount: lee profile del user
 *   - si profile.nickname IS NULL → muestra modal con default sugerido
 *   - guardar: UPDATE profiles SET nickname = ... + refresh
 *
 * Se monta en App.jsx para que aplique a TODA la app (no por página).
 */
export default function NicknameModal({ session, onSaved }) {
  const [profile, setProfile] = useState(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }
    supabase
      .from('profiles')
      .select('id, full_name, nickname')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          if (!data.nickname) {
            setNickname(defaultNickname(data.full_name))
          }
        }
        setLoading(false)
      })
  }, [session?.user?.id])

  async function handleSave() {
    setError(null)
    const v = validateNickname(nickname)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setSaving(true)

    // Check uniqueness (case-insensitive)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nickname', v.value)
      .neq('id', session.user.id)
      .limit(1)

    if (existing && existing.length > 0) {
      setError('Ese nickname ya está cogido. Prueba otro.')
      setSaving(false)
      return
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ nickname: v.value })
      .eq('id', session.user.id)

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved?.(v.value)
  }

  // No render conditions
  if (loading) return null
  if (!profile) return null
  if (profile.nickname) return null  // ya tiene nickname → no mostrar

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '28px 24px',
        maxWidth: '420px', width: '100%',
        border: '1px solid rgba(255,204,0,0.2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
      }}>
        <div style={{
          fontSize: '11px', fontWeight: '800', color: 'var(--gold)',
          letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '8px'
        }}>
          Falta tu nickname
        </div>
        <div style={{
          fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)',
          marginBottom: '8px', letterSpacing: '-0.3px'
        }}>
          ¡Elige cómo te verán! 👋
        </div>
        <div style={{
          fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5',
          marginBottom: '18px'
        }}>
          Así aparecerás en la clasificación, foro y comparativas H2H.
          Te hemos pre-rellenado uno por defecto — cámbialo si quieres.
        </div>

        <label style={{
          display: 'block', fontSize: '11px', color: 'var(--text-dim)',
          fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase',
          marginBottom: '6px'
        }}>
          Tu nickname
        </label>
        <input
          type="text"
          value={nickname}
          onChange={e => { setNickname(e.target.value); setError(null) }}
          autoFocus
          placeholder="ej: javi.albacar"
          maxLength={30}
          style={{
            width: '100%', padding: '12px 14px',
            borderRadius: '10px',
            border: error ? '1.5px solid #e74c3c' : '1px solid var(--border-light)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '15px', fontWeight: '600',
            boxSizing: 'border-box',
            outline: 'none'
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        />

        {error && (
          <div style={{
            marginTop: '8px', fontSize: '12px', color: '#e74c3c', fontWeight: '600'
          }}>
            {error}
          </div>
        )}

        <div style={{
          marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)',
          lineHeight: '1.5'
        }}>
          3-30 caracteres · solo letras, números, puntos, guiones y _
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '20px', width: '100%',
            padding: '14px',
            borderRadius: '10px', border: 'none',
            background: saving ? 'var(--bg-input)' : 'var(--green)',
            color: '#fff', fontSize: '14px', fontWeight: '700',
            cursor: saving ? 'not-allowed' : 'pointer',
            letterSpacing: '0.6px', textTransform: 'uppercase',
            transition: 'background 0.15s ease'
          }}
        >
          {saving ? 'Guardando…' : 'Guardar nickname'}
        </button>

        <div style={{
          marginTop: '14px', fontSize: '11px', color: 'var(--text-dim)',
          textAlign: 'center', lineHeight: '1.5'
        }}>
          Tu nombre real (<strong style={{ color: 'var(--text-muted)' }}>{profile.full_name}</strong>) lo seguimos guardando por separado pero no se mostrará públicamente.
        </div>
      </div>
    </div>
  )
}
