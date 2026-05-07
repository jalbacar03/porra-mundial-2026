import { useState, useRef } from 'react'
import { supabase } from '../supabase'
import Avatar from './Avatar'

/**
 * Modal for uploading/changing/removing a profile avatar.
 * - Accepts JPG/PNG/WebP, max 2MB.
 * - Compresses + center-crops to 512x512 square JPEG before upload to keep
 *   bandwidth and storage small (<60KB typical).
 * - Stores under avatars/{userId}/avatar.jpg, overwriting on each upload.
 */
export default function AvatarUploadModal({ profile, userId, onClose, onUpdated }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)

  async function compressAndCrop(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const target = 512
        const canvas = document.createElement('canvas')
        canvas.width = target
        canvas.height = target
        const ctx = canvas.getContext('2d')
        // Square center-crop from source
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, target, target)
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
          'image/jpeg',
          0.85
        )
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo JPG, PNG o WebP')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Imagen demasiado grande (máx 8MB antes de comprimir)')
      return
    }

    setUploading(true)
    try {
      const blob = await compressAndCrop(file)
      const path = `${userId}/avatar.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust so the new image shows immediately
      const url = `${pub.publicUrl}?t=${Date.now()}`

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId)
      if (profileErr) throw profileErr

      setPreviewUrl(url)
      onUpdated?.(url)
      // Auto-close after a beat so the user sees the new avatar
      setTimeout(() => onClose?.(), 600)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!confirm('¿Quitar tu foto de perfil?')) return
    setUploading(true)
    setError(null)
    try {
      await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`])
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)
      if (profileErr) throw profileErr
      onUpdated?.(null)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al quitar')
    } finally {
      setUploading(false)
    }
  }

  const currentUrl = previewUrl ?? profile?.avatar_url
  const name = profile?.nickname || profile?.full_name

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)', borderRadius: '16px',
          padding: '24px', width: '100%', maxWidth: '340px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
          Foto de perfil
        </h3>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Avatar
            url={currentUrl}
            name={name}
            size={120}
            color="rgba(0,144,81,0.18)"
            border="2px solid rgba(0,144,81,0.3)"
            textColor="#4ade80"
          />
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: '12px', borderRadius: '6px',
            background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)',
            color: '#e74c3c', fontSize: '12px', textAlign: 'center'
          }}>{error}</div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%', padding: '12px', marginBottom: '8px',
            borderRadius: '8px', border: 'none',
            background: 'var(--green)', color: '#fff',
            fontSize: '14px', fontWeight: '600',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1
          }}
        >
          {uploading ? 'Subiendo…' : currentUrl ? 'Cambiar foto' : 'Subir foto'}
        </button>

        {currentUrl && (
          <button
            onClick={handleRemove}
            disabled={uploading}
            style={{
              width: '100%', padding: '10px', marginBottom: '8px',
              borderRadius: '8px',
              border: '1px solid rgba(231,76,60,0.3)',
              background: 'transparent', color: '#e74c3c',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              opacity: uploading ? 0.5 : 1
            }}
          >
            Quitar foto
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px', marginTop: '4px',
            borderRadius: '8px', border: 'none',
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: '13px', cursor: 'pointer'
          }}
        >
          Cancelar
        </button>

        <p style={{
          fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center',
          marginTop: '12px', lineHeight: '1.4'
        }}>
          JPG, PNG o WebP. Se recortará a un cuadrado.
        </p>
      </div>
    </div>
  )
}
