import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Forum({ session }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [profiles, setProfiles] = useState({})
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetchMessages()
    fetchProfiles()

    // Real-time subscription
    const channel = supabase
      .channel('forum')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'forum_messages'
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    const { data } = await supabase
      .from('forum_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
    if (data) setMessages(data)
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
    if (data) {
      const map = {}
      data.forEach(p => { map[p.id] = p.full_name })
      setProfiles(map)
    }
  }

  async function handleSend() {
    const text = newMessage.trim()
    if (!text || sending) return
    setSending(true)
    setNewMessage('')

    await supabase.from('forum_messages').insert({
      user_id: session.user.id,
      message: text
    })

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

  // Group messages by date for date separators
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
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border)'
      }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>
          💬 Foro
        </h2>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {messages.length} mensajes · {Object.keys(profiles).length} participantes
        </span>
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
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '14px',
            marginTop: '40px'
          }}>
            ¡Sé el primero en escribir! 🎉
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.user_id === myId
          const name = profiles[msg.user_id] || 'Cargando...'
          const isBot = msg.user_id === 'b0365b03-65b0-365b-0365-b0365b036500'

          // Show date separator
          const prevMsg = messages[i - 1]
          const showDateSep = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at)

          // Show name if different user or first after date separator
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
                alignItems: isMine ? 'flex-end' : 'flex-start',
                marginTop: showName ? '8px' : '1px'
              }}>
                {/* Name + avatar */}
                {showName && !isMine && (
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
                      background: isBot ? 'var(--gold)' : 'var(--green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      {isBot ? '🤖' : getInitials(name)}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: isBot ? 'var(--gold)' : 'var(--text-muted)'
                    }}>
                      {name}
                    </span>
                  </div>
                )}

                {/* Bubble */}
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isMine ? 'var(--green)' : 'var(--bg-secondary)',
                  border: isMine ? 'none' : '0.5px solid var(--border)',
                  color: isMine ? '#fff' : 'var(--text-primary)',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  wordBreak: 'break-word'
                }}>
                  {msg.message}
                  <div style={{
                    fontSize: '10px',
                    color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--text-dim)',
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

      {/* Input area */}
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
          placeholder="Escribe un mensaje..."
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
            background: newMessage.trim() ? 'var(--green)' : 'var(--bg-input)',
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
    </div>
  )
}
