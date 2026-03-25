import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'

export default function Forum({ session }) {
  const [messages, setMessages] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [profiles, setProfiles] = useState({})
  const [activeTab, setActiveTab] = useState('general')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const isAdmin = session.user.id === ADMIN_ID

  useEffect(() => {
    fetchMessages()
    fetchAnnouncements()
    fetchProfiles()

    // Real-time subscription for general messages
    const generalChannel = supabase
      .channel('forum-general')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'forum_messages',
        filter: 'channel=eq.general'
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          const tempIdx = prev.findIndex(m =>
            typeof m.id === 'string' && m.id.startsWith('temp-') &&
            m.user_id === payload.new.user_id &&
            m.message === payload.new.message
          )
          if (tempIdx >= 0) {
            const updated = [...prev]
            updated[tempIdx] = payload.new
            return updated
          }
          return [...prev, payload.new]
        })
      })
      .subscribe()

    // Real-time subscription for announcements
    const announcementChannel = supabase
      .channel('forum-announcements')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'forum_messages',
        filter: 'channel=eq.announcements'
      }, (payload) => {
        setAnnouncements(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          const tempIdx = prev.findIndex(m =>
            typeof m.id === 'string' && m.id.startsWith('temp-')
          )
          if (tempIdx >= 0) {
            const updated = [...prev]
            updated[tempIdx] = payload.new
            return updated
          }
          return [...prev, payload.new]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(generalChannel)
      supabase.removeChannel(announcementChannel)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, announcements, activeTab])

  async function fetchMessages() {
    const { data } = await supabase
      .from('forum_messages')
      .select('*')
      .or('channel.eq.general,channel.is.null')
      .order('created_at', { ascending: true })
      .limit(200)
    if (data) setMessages(data)
  }

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('forum_messages')
      .select('*')
      .eq('channel', 'announcements')
      .order('created_at', { ascending: true })
      .limit(50)
    if (data) setAnnouncements(data)
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, nickname')
    if (data) {
      const map = {}
      data.forEach(p => { map[p.id] = p.nickname || p.full_name })
      setProfiles(map)
    }
  }

  async function handleSend() {
    const text = newMessage.trim()
    if (!text || sending) return
    setSending(true)
    setNewMessage('')

    const channel = activeTab === 'announcements' ? 'announcements' : 'general'

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      user_id: session.user.id,
      message: text,
      channel,
      created_at: new Date().toISOString()
    }

    if (channel === 'announcements') {
      setAnnouncements(prev => [...prev, optimisticMsg])
    } else {
      setMessages(prev => [...prev, optimisticMsg])
    }

    const { data, error } = await supabase.from('forum_messages').insert({
      user_id: session.user.id,
      message: text,
      channel
    }).select().single()

    if (data) {
      if (channel === 'announcements') {
        setAnnouncements(prev => prev.map(m => m.id === tempId ? data : m))
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? data : m))
      }
    } else if (error) {
      if (channel === 'announcements') {
        setAnnouncements(prev => prev.filter(m => m.id !== tempId))
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

    if (isToday) return time
    if (isYesterday) return `Ayer ${time}`
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ` ${time}`
  }

  function getInitials(name) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function getDateLabel(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Hoy'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const myId = session.user.id
  const activeMessages = activeTab === 'announcements' ? announcements : messages
  const canPost = activeTab === 'general' || isAdmin

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100svh - 120px)',
      padding: '0'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 0',
        borderBottom: '1px solid var(--border)'
      }}>
        <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>
          💬 Foro
        </h2>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '2px',
          padding: '3px', background: 'var(--bg-input)', borderRadius: '6px',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: '4px', border: 'none',
              background: activeTab === 'general' ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === 'general' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: activeTab === 'general' ? '600' : '400', cursor: 'pointer'
            }}
          >
            🗣 Foro general
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: '4px', border: 'none',
              background: activeTab === 'announcements' ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === 'announcements' ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: activeTab === 'announcements' ? '600' : '400', cursor: 'pointer'
            }}
          >
            📢 Comunicados
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {activeTab === 'announcements' && (
          <div style={{
            padding: '8px 12px',
            marginBottom: '8px',
            background: 'rgba(255,204,0,0.06)',
            border: '0.5px solid rgba(255,204,0,0.15)',
            borderRadius: '6px',
            fontSize: '11px',
            color: 'var(--gold)',
            textAlign: 'center'
          }}>
            Comunicados oficiales del comité organizador
          </div>
        )}

        {activeMessages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
            marginTop: '40px'
          }}>
            {activeTab === 'announcements'
              ? 'No hay comunicados todavía'
              : '¡Sé el primero en escribir! 🎉'
            }
          </div>
        )}

        {activeMessages.map((msg, i) => {
          const isMine = msg.user_id === myId
          const name = profiles[msg.user_id] || 'Cargando...'
          const isBot = msg.user_id === 'b0365b03-65b0-365b-0365-b0365b036500'
          const isAdminMsg = msg.user_id === ADMIN_ID
          const isAnnouncement = activeTab === 'announcements'

          const prevMsg = activeMessages[i - 1]
          const showDateSep = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at)
          const showName = showDateSep || !prevMsg || prevMsg.user_id !== msg.user_id

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div style={{
                  textAlign: 'center',
                  margin: '16px 0 8px',
                  fontSize: '11px',
                  color: 'var(--text-dim)',
                  textTransform: 'capitalize'
                }}>
                  <span style={{
                    background: 'var(--bg-input)',
                    padding: '3px 12px',
                    borderRadius: '10px'
                  }}>
                    {getDateLabel(msg.created_at)}
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isAnnouncement ? 'flex-start' : (isMine ? 'flex-end' : 'flex-start'),
                marginTop: showName ? '8px' : '1px'
              }}>
                {showName && (!isMine || isAnnouncement) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '2px',
                    marginLeft: '4px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: isBot ? 'var(--gold)' : isAnnouncement ? '#c0a050' : 'var(--green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      {isBot ? '🤖' : isAnnouncement ? '📢' : getInitials(name)}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: isBot ? 'var(--gold)' : isAnnouncement ? 'var(--gold)' : 'var(--text-muted)'
                    }}>
                      {isAnnouncement ? 'Comité Organizador' : name}
                    </span>
                  </div>
                )}

                <div style={{
                  maxWidth: isAnnouncement ? '100%' : '80%',
                  padding: isAnnouncement ? '12px 16px' : '8px 12px',
                  borderRadius: isAnnouncement ? '8px' : (isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'),
                  background: isAnnouncement
                    ? 'linear-gradient(135deg, rgba(192,160,80,0.1), rgba(192,160,80,0.05))'
                    : (isMine ? 'var(--green)' : 'var(--bg-secondary)'),
                  border: isAnnouncement
                    ? '0.5px solid rgba(255,204,0,0.2)'
                    : (isMine ? 'none' : '0.5px solid var(--border)'),
                  color: isMine && !isAnnouncement ? '#fff' : 'var(--text-primary)',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  wordBreak: 'break-word'
                }}>
                  {msg.message}
                  <div style={{
                    fontSize: '10px',
                    color: isMine && !isAnnouncement ? 'rgba(255,255,255,0.6)' : 'var(--text-dim)',
                    textAlign: 'right',
                    marginTop: '2px'
                  }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area — only show if user can post */}
      {canPost ? (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-primary)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}>
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeTab === 'announcements' ? 'Escribir comunicado...' : 'Escribe un mensaje...'}
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '20px',
              border: '0.5px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              maxHeight: '100px',
              lineHeight: '1.4'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              background: newMessage.trim() ? (activeTab === 'announcements' ? '#c0a050' : 'var(--green)') : 'var(--bg-input)',
              color: newMessage.trim() ? '#fff' : 'var(--text-dim)',
              cursor: newMessage.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
              transition: 'background 0.2s'
            }}
          >
            ➤
          </button>
        </div>
      ) : (
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-dim)'
        }}>
          Solo el comité organizador puede publicar comunicados
        </div>
      )}
    </div>
  )
}
