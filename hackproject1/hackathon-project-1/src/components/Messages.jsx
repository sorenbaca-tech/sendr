import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  doc,
  getDocs,
} from 'firebase/firestore'

const MESSAGES_COL = 'messages'
const PARTICIPANTS_COL = 'participants'

function shortNameFromEmail(email) {
  const local = email.split('@')[0] || email
  return local.replace(/[._\-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const USER_KEY = 'chat_user'

function getStoredUser() {
  try {
    const s = sessionStorage.getItem(USER_KEY)
    return s ? JSON.parse(s) : null
  } catch (e) {
    return null
  }
}

function saveStoredUser(user) {
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch (e) {
    // ignore
  }
}

export default function Messages() {
  const [messages, setMessages] = useState([])
  const [value, setValue] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [participants, setParticipants] = useState([])
  const [notification, setNotification] = useState('')
  const [currentUser, setCurrentUser] = useState(() => getStoredUser())
  const [signupEmail, setSignupEmail] = useState('')
  const [signupName, setSignupName] = useState('')

  const listRef = useRef(null)
  const emailRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (currentUser) saveStoredUser(currentUser)
  }, [currentUser])

  // real-time messages listener
  useEffect(() => {
    const q = query(collection(db, MESSAGES_COL), orderBy('ts', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // load participants once
  useEffect(() => {
    getDocs(collection(db, PARTICIPANTS_COL)).then((snap) => {
      setParticipants(snap.docs.map((d) => d.data()))
    })
  }, [])

  async function send() {
    const text = value.trim()
    if (!text) return
    const sender = (currentUser && currentUser.email) || 'you@example.com'
    const name = (currentUser && currentUser.name) || 'You'
    setValue('')
    await addDoc(collection(db, MESSAGES_COL), { sender, name, text, ts: Date.now() })
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

  async function addParticipant() {
    const email = shareEmail.trim().toLowerCase()
    if (!isValidEmail(email)) {
      if (emailRef.current) emailRef.current.focus()
      return
    }
    if (participants.find((p) => p.email === email)) {
      setShareEmail('')
      return
    }
    const name = shortNameFromEmail(email)
    setShareEmail('')
    await setDoc(doc(db, PARTICIPANTS_COL, email), { email, name })
    setParticipants((s) => [...s, { email, name }])
    await addDoc(collection(db, MESSAGES_COL), {
      sender: 'system', name: 'System',
      text: `${name} (${email}) joined the group.`, ts: Date.now(),
    })
    setNotification(`Email sent to ${email} with chat access link.`)
    setTimeout(() => setNotification(''), 3000)
  }

  async function completeSignup(userEmail, displayName) {
    const email = userEmail.trim().toLowerCase()
    const name = displayName.trim() || shortNameFromEmail(email)
    const u = { email, name }
    setCurrentUser(u)
    if (!participants.find((p) => p.email === email)) {
      await setDoc(doc(db, PARTICIPANTS_COL, email), { email, name })
      setParticipants((s) => [...s, { email, name }])
    }
    await addDoc(collection(db, MESSAGES_COL), {
      sender: 'system', name: 'System',
      text: `${name} (${email}) joined as you.`, ts: Date.now(),
    })
    setNotification(`Signed in as ${name} <${email}>`)
    setTimeout(() => setNotification(''), 2500)
  }

  if (!currentUser) {
    return (
      <section className="component-card messages-wrapper">
        <style>{`
          .messages-wrapper { display:flex; flex-direction:column; height:360px; }
          .signup { display:flex; flex-direction:column; gap:8px; padding:16px }
          .signup input { padding:8px 10px; border:1px solid var(--border); border-radius:6px; background:var(--code-bg); color:var(--text-h) }
          .signup button { padding:8px 12px; border-radius:6px; background:var(--accent); color:white; border:none; align-self:flex-end }
        `}</style>

        <div className="signup">
          <h3>Sign in to Chat</h3>
          <input
            aria-label="Your email"
            placeholder="you@example.com"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
          />
          <input
            aria-label="Display name"
            placeholder="How should others see you?"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => completeSignup(signupEmail, signupName)}
              disabled={!isValidEmail(signupEmail)}
            >
              Join Chat
            </button>
          </div>
        </div>
      </section>
    )
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
          const isYou = currentUser && m.sender === currentUser.email
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
