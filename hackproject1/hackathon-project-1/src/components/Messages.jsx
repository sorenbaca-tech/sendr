import React, { useEffect, useRef, useState } from 'react'

const sample = [
  { id: 1, sender: 'alice@example.com', name: 'Alice', text: 'Welcome to the group chat!', ts: Date.now() - 1000 * 60 * 60 },
  { id: 2, sender: 'bob@example.com', name: 'Bob', text: 'Hey — excited to build this together.', ts: Date.now() - 1000 * 60 * 10 },
]

function shortNameFromEmail(email) {
  const local = email.split('@')[0] || email
  return local.replace(/[._\-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Messages() {
  const [messages, setMessages] = useState(sample)
  const [value, setValue] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [participants, setParticipants] = useState(() => {
    // derive participants from sample messages
    const map = {}
    sample.forEach((m) => {
      map[m.sender] = { email: m.sender, name: m.name || shortNameFromEmail(m.sender) }
    })
    return Object.values(map)
  })
  const [notification, setNotification] = useState('')

  const listRef = useRef(null)
  const emailRef = useRef(null)

  useEffect(() => {
    // auto-scroll to bottom on new message
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function send() {
    const text = value.trim()
    if (!text) return
    const m = { id: Date.now(), sender: 'you@example.com', name: 'You', text, ts: Date.now() }
    setMessages((s) => [...s, m])
    setValue('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function addParticipant() {
    const email = shareEmail.trim().toLowerCase()
    if (!isValidEmail(email)) {
      // simple feedback: focus the input
      if (emailRef.current) emailRef.current.focus()
      return
    }
    if (participants.find((p) => p.email === email)) {
      setShareEmail('')
      return
    }
    const name = shortNameFromEmail(email)
    const p = { email, name }
    setParticipants((s) => [...s, p])
    setShareEmail('')
    // post a system message announcing join
    const joinMsg = { id: Date.now() + 1, sender: 'system', name: 'System', text: `${name} (${email}) joined the group.`, ts: Date.now() }
    setMessages((s) => [...s, joinMsg])
    // mock email notification
    setNotification(`Email sent to ${email} with chat access link.`)
    setTimeout(() => setNotification(''), 3000)
  }

  return (
    <section className="component-card messages-wrapper">
      <style>{`
        .messages-wrapper { display:flex; flex-direction:column; height:360px; }
        .messages-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px }
        .participants { font-size:12px; color:var(--text); opacity:0.85 }
        .share-box { display:flex; gap:8px; align-items:center }
        .share-box input { padding:6px 8px; border-radius:6px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h) }
        .share-box button { padding:6px 10px; border-radius:6px; background:var(--accent); color:white; border:none }
        .messages-list { flex:1; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:8px }
        .message { max-width:78%; padding:8px 10px; border-radius:10px; background:var(--bg); border:1px solid var(--border); color:var(--text); }
        .message .meta { font-size:12px; color:var(--text); opacity:0.7; margin-bottom:6px }
        .message.you { margin-left:auto; background:var(--accent-bg); border-color:var(--accent-border); }
        .message.system { margin:0 auto; max-width:100%; background:transparent; border:none; color:var(--text); opacity:0.8; text-align:center }
        .composer { display:flex; gap:8px; margin-top:8px; flex-direction:column }
        .composer textarea { flex:1; resize:none; min-height:38px; max-height:120px; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h) }
        .composer button { padding:8px 12px; border-radius:6px; background:var(--accent); color:white; border:none; align-self:flex-end }
        .notification { padding:8px 12px; border-radius:6px; background:var(--accent-bg); border:1px solid var(--accent-border); color:var(--accent); font-size:13px; animation:slideIn 0.3s ease-out }
        @keyframes slideIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div className="messages-header">
        <div>
          <strong>Group Chat</strong>
          <div className="participants">Participants: {participants.length}</div>
        </div>

        <div className="share-box">
          <input
            ref={emailRef}
            aria-label="Share with email"
            placeholder="Add email to share"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addParticipant() } }}
          />
          <button type="button" onClick={addParticipant}>Add</button>
        </div>
      </div>

      <div className="messages-list" ref={listRef} aria-live="polite">
        {messages.map((m) => {
          if (m.sender === 'system') {
            return (
              <div key={m.id} className="message system">
                <div>{m.text}</div>
              </div>
            )
          }
          const isYou = m.sender === 'you@example.com'
          return (
            <div key={m.id} className={isYou ? 'message you' : 'message'}>
              <div className="meta">{m.name || shortNameFromEmail(m.sender)} · {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div>{m.text}</div>
            </div>
          )
        })}
      </div>

      <div className="composer">
        {notification && <div className="notification">{notification}</div>}
        <textarea
          placeholder="Message the group... (Enter to send, Shift+Enter for newline)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" onClick={send}>Send</button>
      </div>
    </section>
  )
}
