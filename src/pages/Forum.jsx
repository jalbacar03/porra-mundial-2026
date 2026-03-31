import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'

const ADMIN_ID = 'e2fc4937-cd8d-4cb1-8291-05fa8a66ce97'
const REACTION_EMOJIS = ['👍', '⚽', '🔥', '😂']

export default function Forum({ session }) {
  const [messages, setMessages] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [profiles, setProfiles] = useState({})
  const [activeTab, setActiveTab] = useState('general')
  const [reactions, setReactions] = useState({}) // { messageId: { emoji: [userId, ...] } }
  const [replyTo, setReplyTo] = useState(null) // message object being replied to
  const [showReactionPicker, setShowReactionPicker] = useState(null) // message id
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const myId = session.user.id
  const isAdmin = myId === ADMIN_ID
  const [mutedUsers, setMutedUsers] = useState({}) // { userId: true }
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    fetchMessages()
    fetchAnnouncements()
    fetchProfiles()
    fetchAllReactions()
    fetchMutedStatus()

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

    // Separate DELETE channel without filter — default REPLICA IDENTITY
    // only sends PK in payload.old, so channel filter won't match on DELETE
    const deleteChannel = supabase
      .channel('forum-deletes')
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'forum_messages'
      }, (payload) => {
        const deletedId = payload.old.id
        setMessages(prev => prev.filter(m => m.id !== deletedId))
        setAnnouncements(prev => prev.filter(m => m.id !== deletedId))
      })
      .subscribe()

    // Realtime reactions
    const reactionsChannel = supabase
      .channel('forum-reactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'forum_reactions'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new
          setReactions(prev => {
            const msgReactions = { ...(prev[r.message_id] || {}) }
            const users = [...(msgReactions[r.emoji] || [])]
            if (!users.includes(r.user_id)) users.push(r.user_id)
            msgReactions[r.emoji] = users
            return { ...prev, [r.message_id]: msgReactions }
          })
        } else if (payload.eventType === 'DELETE') {
          const r = payload.old
          setReactions(prev => {
            const msgReactions = { ...(prev[r.message_id] || {}) }
            const users = (msgReactions[r.emoji] || []).filter(id => id !== r.user_id)
            if (users.length === 0) {
              delete msgReactions[r.emoji]
            } else {
              msgReactions[r.emoji] = users
            }
            return { ...prev, [r.message_id]: msgReactions }
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(generalChannel)
      supabase.removeChannel(announcementChannel)
      supabase.removeChannel(deleteChannel)
      supabase.removeChannel(reactionsChannel)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, announcements, activeTab])

  async function fetchMutedStatus() {
    // Check if current user is muted
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('is_muted')
      .eq('id', myId)
      .single()
    if (myProfile?.is_muted) setIsMuted(true)

    // Admin: fetch all muted users
    if (isAdmin) {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, is_muted')
        .eq('is_muted', true)
      if (allProfiles) {
        const map = {}
        allProfiles.forEach(p => { map[p.id] = true })
        setMutedUsers(map)
      }
    }
  }

  async function handleDeleteMessage(msgId) {
    if (!isAdmin) return
    if (!confirm('¿Eliminar este mensaje?')) return
    const { error } = await supabase.from('forum_messages').delete().eq('id', msgId)
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== msgId))
      setAnnouncements(prev => prev.filter(m => m.id !== msgId))
    }
  }

  async function handleToggleMute(userId) {
    if (!isAdmin || userId === ADMIN_ID) return
    const currentlyMuted = mutedUsers[userId]
    const { error } = await supabase
      .from('profiles')
      .update({ is_muted: !currentlyMuted })
      .eq('id', userId)
    if (!error) {
      setMutedUsers(prev => {
        const next = { ...prev }
        if (currentlyMuted) delete next[userId]
        else next[userId] = true
        return next
      })
    }
  }

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

  async function fetchAllReactions() {
    const { data } = await supabase
      .from('forum_reactions')
      .select('*')
    if (data) {
      const map = {}
      data.forEach(r => {
        if (!map[r.message_id]) map[r.message_id] = {}
        if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = []
        map[r.message_id][r.emoji].push(r.user_id)
      })
      setReactions(map)
    }
  }

  const toggleReaction = useCallback(async (messageId, emoji) => {
    const msgReactions = reactions[messageId] || {}
    const users = msgReactions[emoji] || []
    const hasReacted = users.includes(myId)

    // Optimistic update
    setReactions(prev => {
      const msgR = { ...(prev[messageId] || {}) }
      if (hasReacted) {
        const filtered = (msgR[emoji] || []).filter(id => id !== myId)
        if (filtered.length === 0) {
          delete msgR[emoji]
        } else {
          msgR[emoji] = filtered
        }
      } else {
        msgR[emoji] = [...(msgR[emoji] || []), myId]
      }
      return { ...prev, [messageId]: msgR }
    })

    if (hasReacted) {
      await supabase
        .from('forum_reactions')
        .delete()
        .match({ message_id: messageId, user_id: myId, emoji })
    } else {
      await supabase
        .from('forum_reactions')
        .insert({ message_id: messageId, user_id: myId, emoji })
    }

    setShowReactionPicker(null)
  }, [reactions, myId])

  async function handleSend() {
    const text = newMessage.trim()
    if (!text || sending) return
    setSending(true)
    setNewMessage('')

    const channel = activeTab === 'announcements' ? 'announcements' : 'general'

    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      user_id: myId,
      message: text,
      channel,
      reply_to: replyTo?.id || null,
      created_at: new Date().toISOString()
    }

    if (channel === 'announcements') {
      setAnnouncements(prev => [...prev, optimisticMsg])
    } else {
      setMessages(prev => [...prev, optimisticMsg])
    }

    setReplyTo(null)

    const insertData = {
      user_id: myId,
      message: text,
      channel
    }
    if (replyTo?.id && typeof replyTo.id === 'number') {
      insertData.reply_to = replyTo.id
    }

    const { data, error } = await supabase.from('forum_messages').insert(insertData).select().single()

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

  function findMessage(id) {
    return messages.find(m => m.id === id) || announcements.find(m => m.id === id)
  }

  const activeMessages = activeTab === 'announcements' ? announcements : messages
  const canPost = activeTab === 'general' || isAdmin

  function renderReactions(msg) {
    const msgReactions = reactions[msg.id] || {}
    const entries = Object.entries(msgReactions).filter(([, users]) => users.length > 0)
    if (entries.length === 0) return null

    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px'
      }}>
        {entries.map(([emoji, users]) => {
          const iReacted = users.includes(myId)
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(msg.id, emoji)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '2px 6px', borderRadius: '10px', border: 'none',
                background: iReacted ? 'rgba(0,122,69,0.2)' : 'rgba(42,45,56,0.6)',
                color: iReacted ? '#007a45' : '#9da3b0',
                fontSize: '12px', cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '13px' }}>{emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: '600' }}>{users.length}</span>
            </button>
          )
        })}
      </div>
    )
  }

  function renderReplyPreview(msg) {
    if (!msg.reply_to) return null
    const original = findMessage(msg.reply_to)
    if (!original) return null

    const originalName = profiles[original.user_id] || 'Usuario'
    const preview = original.message.length > 60
      ? original.message.slice(0, 60) + '...'
      : original.message

    return (
      <div style={{
        padding: '4px 8px',
        marginBottom: '4px',
        borderLeft: '2px solid #007a45',
        borderRadius: '0 4px 4px 0',
        background: 'rgba(0,122,69,0.08)',
        fontSize: '11px',
        color: '#6b7080',
        lineHeight: '1.3'
      }}>
        <span style={{ fontWeight: '600', color: '#007a45', fontSize: '10px' }}>{originalName}</span>
        <div style={{ marginTop: '1px' }}>{preview}</div>
      </div>
    )
  }

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
        borderBottom: '1px solid #2a2d38'
      }}>
        <h2 style={{ margin: '0 0 8px', color: '#e0e3ea', fontSize: '18px', fontWeight: '700' }}>
          Foro
        </h2>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '2px',
          padding: '3px', background: '#13151c', borderRadius: '6px',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: '4px', border: 'none',
              background: activeTab === 'general' ? '#22252f' : 'transparent',
              color: activeTab === 'general' ? '#e0e3ea' : '#6b7080',
              fontSize: '12px', fontWeight: activeTab === 'general' ? '600' : '400', cursor: 'pointer'
            }}
          >
            Foro general
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: '4px', border: 'none',
              background: activeTab === 'announcements' ? '#22252f' : 'transparent',
              color: activeTab === 'announcements' ? '#ffcc00' : '#6b7080',
              fontSize: '12px', fontWeight: activeTab === 'announcements' ? '600' : '400', cursor: 'pointer'
            }}
          >
            Comunicados Oficiales
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
        onClick={() => setShowReactionPicker(null)}
      >
        {activeTab === 'announcements' && (
          <div style={{
            padding: '8px 12px',
            marginBottom: '8px',
            background: 'rgba(255,204,0,0.06)',
            border: '0.5px solid rgba(255,204,0,0.15)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#ffcc00',
            textAlign: 'center'
          }}>
            Comunicados Oficiales del comité organizador
          </div>
        )}

        {activeMessages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#6b7080',
            fontSize: '14px',
            marginTop: '40px'
          }}>
            {activeTab === 'announcements'
              ? 'No hay comunicados todavía'
              : 'Se el primero en escribir!'
            }
          </div>
        )}

        {activeMessages.map((msg, i) => {
          const isMine = msg.user_id === myId
          const name = profiles[msg.user_id] || 'Cargando...'
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
                  color: '#4a4f5e',
                  textTransform: 'capitalize'
                }}>
                  <span style={{
                    background: '#13151c',
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
                marginTop: showName ? '10px' : '2px'
              }}>
                {showName && (!isMine || isAnnouncement) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '3px',
                    marginLeft: '4px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isAnnouncement ? '#c0a050' : '#007a45',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      {isAnnouncement ? '📢' : getInitials(name)}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: isAnnouncement ? '#ffcc00' : '#6b7080'
                    }}>
                      {isAnnouncement ? 'Comité Organizador' : name}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    maxWidth: isAnnouncement ? '100%' : '80%',
                    position: 'relative'
                  }}
                >
                  {/* Reply preview inside bubble */}
                  {renderReplyPreview(msg)}

                  <div style={{
                    padding: isAnnouncement ? '12px 16px' : '8px 12px',
                    borderRadius: isAnnouncement ? '8px' : (isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px'),
                    background: isAnnouncement
                      ? 'linear-gradient(135deg, rgba(192,160,80,0.1), rgba(192,160,80,0.05))'
                      : (isMine ? '#007a45' : '#22252f'),
                    border: isAnnouncement
                      ? '0.5px solid rgba(255,204,0,0.2)'
                      : (isMine ? 'none' : '0.5px solid #2a2d38'),
                    boxShadow: (isAnnouncement && isAdminMsg)
                      ? '0 0 12px rgba(255,204,0,0.08)'
                      : 'none',
                    color: isMine && !isAnnouncement ? '#fff' : '#e0e3ea',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    wordBreak: 'break-word'
                  }}>
                    {msg.message}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '3px',
                      gap: '8px'
                    }}>
                      <span style={{
                        fontSize: '10px',
                        color: isMine && !isAnnouncement ? 'rgba(255,255,255,0.6)' : '#4a4f5e',
                        flex: 1,
                        textAlign: 'right'
                      }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Reactions display */}
                  {renderReactions(msg)}

                  {/* Action row: reply + add reaction + admin */}
                  {typeof msg.id === 'number' && (
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      marginTop: '2px',
                      justifyContent: isMine && !isAnnouncement ? 'flex-end' : 'flex-start'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setReplyTo(msg)
                          inputRef.current?.focus()
                        }}
                        style={{
                          background: 'none', border: 'none', padding: '2px 4px',
                          fontSize: '11px', color: '#4a4f5e', cursor: 'pointer',
                          opacity: 0.7
                        }}
                      >
                        ↩ Responder
                      </button>
                      {/* Admin: delete + mute */}
                      {isAdmin && !isMine && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id) }}
                            style={{
                              background: 'none', border: 'none', padding: '2px 4px',
                              fontSize: '11px', color: '#e74c3c', cursor: 'pointer', opacity: 0.7
                            }}
                          >
                            🗑 Eliminar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleMute(msg.user_id) }}
                            style={{
                              background: 'none', border: 'none', padding: '2px 4px',
                              fontSize: '11px', color: mutedUsers[msg.user_id] ? '#4ade80' : '#e74c3c',
                              cursor: 'pointer', opacity: 0.7
                            }}
                          >
                            {mutedUsers[msg.user_id] ? '🔊 Desmutar' : '🔇 Silenciar'}
                          </button>
                        </>
                      )}
                      {isAdmin && isMine && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id) }}
                          style={{
                            background: 'none', border: 'none', padding: '2px 4px',
                            fontSize: '11px', color: '#e74c3c', cursor: 'pointer', opacity: 0.7
                          }}
                        >
                          🗑 Eliminar
                        </button>
                      )}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)
                          }}
                          style={{
                            background: 'none', border: 'none', padding: '2px 4px',
                            fontSize: '13px', color: '#4a4f5e', cursor: 'pointer',
                            opacity: 0.7
                          }}
                        >
                          +
                        </button>

                        {/* Reaction picker */}
                        {showReactionPicker === msg.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: isMine ? 'auto' : '0',
                              right: isMine ? '0' : 'auto',
                              background: '#22252f',
                              border: '1px solid #2a2d38',
                              borderRadius: '12px',
                              padding: '4px 6px',
                              display: 'flex',
                              gap: '2px',
                              zIndex: 10,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                              marginBottom: '4px'
                            }}
                          >
                            {REACTION_EMOJIS.map(emoji => {
                              const msgR = reactions[msg.id] || {}
                              const iReacted = (msgR[emoji] || []).includes(myId)
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  style={{
                                    background: iReacted ? 'rgba(0,122,69,0.2)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '18px',
                                    cursor: 'pointer',
                                    transition: 'transform 0.1s ease'
                                  }}
                                >
                                  {emoji}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview bar */}
      {replyTo && canPost && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #2a2d38',
          background: '#1a1d26',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            flex: 1,
            padding: '6px 10px',
            borderLeft: '2px solid #007a45',
            borderRadius: '0 4px 4px 0',
            background: 'rgba(0,122,69,0.06)',
            fontSize: '12px',
            color: '#6b7080',
            lineHeight: '1.3',
            overflow: 'hidden'
          }}>
            <div style={{ fontWeight: '600', color: '#007a45', fontSize: '10px', marginBottom: '1px' }}>
              {profiles[replyTo.user_id] || 'Usuario'}
            </div>
            <div style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {replyTo.message}
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{
              background: 'none', border: 'none', color: '#6b7080',
              fontSize: '16px', cursor: 'pointer', padding: '4px',
              flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Muted warning */}
      {isMuted && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #2a2d38',
          background: 'rgba(231,76,60,0.06)',
          textAlign: 'center',
          fontSize: '12px',
          color: '#e74c3c',
          fontWeight: '500'
        }}>
          🔇 Has sido silenciado por el administrador. No puedes escribir mensajes.
        </div>
      )}

      {/* Input area */}
      {canPost && !isMuted ? (
        <div style={{
          padding: '10px 16px',
          borderTop: replyTo ? 'none' : '1px solid #2a2d38',
          background: '#1a1d26',
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
              border: '0.5px solid #2a2d38',
              background: '#22252f',
              color: '#e0e3ea',
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
              background: newMessage.trim() ? (activeTab === 'announcements' ? '#c0a050' : '#007a45') : '#13151c',
              color: newMessage.trim() ? '#fff' : '#4a4f5e',
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
      ) : !isMuted ? (
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid #2a2d38',
          textAlign: 'center',
          fontSize: '12px',
          color: '#4a4f5e'
        }}>
          Solo el comité organizador puede publicar comunicados oficiales
        </div>
      ) : null}
    </div>
  )
}
