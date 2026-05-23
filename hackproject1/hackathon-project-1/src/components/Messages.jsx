import React, { useEffect, useMemo, useRef, useState } from 'react'
import { onValue, push, ref, update } from 'firebase/database'
import { rtdb } from '../firebase'

function encodeEmail(email) {
  return (email || '').replace(/\./g, ',')
}

function shortNameFromEmail(email) {
  const local = (email || '').split('@')[0] || email || 'Project'
  return local.replace(/[._\-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function userKey(projectKey) {
  return `chat_user_${projectKey}`
}

function getStoredIdentity() {
  try {
    const stored = localStorage.getItem('user-identity')
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed.email === 'string' && typeof parsed.name === 'string') {
      return parsed
    }
  } catch (error) {
    console.error('Failed to read shared identity', error)
  }

  return null
}

function getStoredUser(projectKey) {
  try {
    const s = sessionStorage.getItem(userKey(projectKey))
    return s ? JSON.parse(s) : null
  } catch (e) {
    return null
  }
}

function saveStoredUser(projectKey, user) {
  try {
    sessionStorage.setItem(userKey(projectKey), JSON.stringify(user))
  } catch (e) {}
}

function normalizeMember(member) {
  if (!member || !member.email) {
    return null
  }

  return {
    email: String(member.email).trim().toLowerCase(),
    name: typeof member.name === 'string' && member.name.trim() ? member.name.trim() : shortNameFromEmail(member.email)
  }
}

function dedupeParticipants(participants) {
  const byEmail = new Map()

  participants.forEach((participant) => {
    if (!participant) {
      return
    }

    byEmail.set(participant.email, participant)
  })

  return Array.from(byEmail.values())
}

export default function Messages({ projectKey = 1 }) {
  const [messages, setMessages] = useState([])
  const [value, setValue] = useState('')
  const [projectMembers, setProjectMembers] = useState([])
  const [currentUser, setCurrentUser] = useState(() => getStoredUser(projectKey) || getStoredIdentity() || {
    email: `guest_${Math.random().toString(36).slice(2, 8)}@local`,
    name: 'Guest'
  })
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const listRef = useRef(null)
  const nameInputRef = useRef(null)

  const participants = useMemo(() => {
    const current = currentUser && currentUser.email
      ? {
          email: currentUser.email.toLowerCase(),
          name: currentUser.name || shortNameFromEmail(currentUser.email)
        }
      : null

    return dedupeParticipants([current, ...projectMembers].filter(Boolean))
  }, [currentUser, projectMembers])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (currentUser) {
      saveStoredUser(projectKey, currentUser)
    }
  }, [currentUser, projectKey])

  useEffect(() => {
    const membersRef = ref(rtdb, `projects/project-${projectKey}/members`)

    return onValue(membersRef, (snap) => {
      const data = snap.val() || {}
      const members = Object.values(data)
        .map(normalizeMember)
        .filter(Boolean)

      setProjectMembers(members)
    })
  }, [projectKey])

  useEffect(() => {
    return onValue(ref(rtdb, `projects/project-${projectKey}/messages`), (snap) => {
      const data = snap.val() || {}
      const msgs = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => a.ts - b.ts)
      setMessages(msgs)
    })
  }, [projectKey])

  async function send() {
    const text = value.trim()
    if (!text) {
      return
    }

    const sender = currentUser?.email || 'project-member@local'
    const name = currentUser?.name || shortNameFromEmail(sender)
    setValue('')

    await push(ref(rtdb, `projects/project-${projectKey}/messages`), {
      sender,
      name,
      text,
      ts: Date.now()
    })
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function openNameEdit() {
    setNameInput(currentUser.name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current && nameInputRef.current.focus(), 0)
  }

  async function saveName() {
    const name = nameInput.trim()
    if (!name || !currentUser?.email) {
      return
    }

    const updatedUser = { ...currentUser, name }
    setCurrentUser(updatedUser)
    setEditingName(false)

    try {
      localStorage.setItem('user-identity', JSON.stringify(updatedUser))
      await update(ref(rtdb, `projects/project-${projectKey}/members/${encodeEmail(updatedUser.email)}`), {
        name: updatedUser.name
      })
    } catch (error) {
      console.error('Failed to update shared name:', error)
    }
  }

  return (
    <section className="component-card messages-wrapper">
      <style>{`
        .messages-wrapper { display:flex; flex-direction:column; height:360px; }
        .messages-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px }
        .participants { font-size:12px; color:var(--text); opacity:0.85 }
        .messages-list { flex:1; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:8px }
        .message { max-width:78%; padding:8px 10px; border-radius:10px; background:var(--bg); border:1px solid var(--border); color:var(--text); }
        .message .meta { font-size:12px; color:var(--text); opacity:0.7; margin-bottom:6px }
        .message.you { margin-left:auto; background:var(--accent-bg); border-color:var(--accent-border); }
        .message.system { margin:0 auto; max-width:100%; background:transparent; border:none; color:var(--text); opacity:0.8; text-align:center }
        .composer { display:flex; gap:8px; margin-top:8px; flex-direction:column }
        .composer textarea { flex:1; resize:none; min-height:38px; max-height:120px; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h) }
        .composer button { padding:8px 12px; border-radius:6px; background:var(--accent); color:white; border:none; align-self:flex-end }
        .name-edit { display:flex; gap:6px; align-items:center }
        .name-edit input { padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h); font-size:13px; width:140px }
        .name-edit button { padding:4px 10px; border-radius:6px; background:var(--accent); color:white; border:none; font-size:13px }
        .name-edit .cancel { background:transparent; color:var(--text); border:1px solid var(--border) }
        .rename-btn { padding:4px 10px; border-radius:6px; background:transparent; border:1px solid var(--border); color:var(--text); font-size:12px; cursor:pointer }
      `}</style>

      <div className="messages-header">
        <div>
          <strong>Group Chat</strong>
          <div className="participants">Participants: {participants.length}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {editingName ? (
            <div className="name-edit">
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                aria-label="New display name"
              />
              <button type="button" onClick={saveName}>Save</button>
              <button type="button" className="cancel" onClick={() => setEditingName(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="rename-btn" onClick={openNameEdit}>
              {currentUser.name} ✎
            </button>
          )}
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
