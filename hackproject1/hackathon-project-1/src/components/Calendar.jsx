import React, { useEffect, useMemo, useState } from 'react'
import { rtdb } from '../firebase'
import { ref, onValue, set, remove } from 'firebase/database'

const START_HOUR = 8
const END_HOUR = 20
const DAYS_IN_WEEK = 7

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const hour = START_HOUR + i
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour
  return { hour, label: `${display}:00 ${suffix}` }
})

const LS_EMAIL = 'calendar-current-email'

const normalize = (email) => email.trim().toLowerCase()
const emailKey = (email) => normalize(email).replace(/[.#$/[\]]/g, '_')
const slotKey = (dayKey, hour) => `${dayKey}-${hour}`

function buildWeek(from) {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    }
  })
}

export default function Calendar() {
  const [currentEmail, setCurrentEmail] = useState(() => {
    try {
      return window.localStorage.getItem(LS_EMAIL) || ''
    } catch {
      return ''
    }
  })
  const [signInInput, setSignInInput] = useState('')
  const [collabInput, setCollabInput] = useState('')

  const [mySlots, setMySlots] = useState({})
  const [collaborators, setCollaborators] = useState([])
  const [collabSlots, setCollabSlots] = useState({})

  const [weekStart, setWeekStart] = useState(() => new Date())
  const days = useMemo(() => buildWeek(weekStart), [weekStart])

  useEffect(() => {
    try {
      if (currentEmail) window.localStorage.setItem(LS_EMAIL, currentEmail)
      else window.localStorage.removeItem(LS_EMAIL)
    } catch {}
  }, [currentEmail])

  useEffect(() => {
    if (!currentEmail) {
      setMySlots({})
      return
    }
    const r = ref(rtdb, `calendar/users/${emailKey(currentEmail)}/slots`)
    return onValue(r, (snap) => {
      const val = snap.val()
      setMySlots(val && typeof val === 'object' ? val : {})
    })
  }, [currentEmail])

  useEffect(() => {
    if (!currentEmail) {
      setCollaborators([])
      return
    }
    const r = ref(rtdb, `calendar/users/${emailKey(currentEmail)}/collaborators`)
    return onValue(r, (snap) => {
      const val = snap.val()
      if (!val) {
        setCollaborators([])
        return
      }
      const list = Array.isArray(val)
        ? val
        : Object.values(val)
      setCollaborators(list.filter((e) => typeof e === 'string' && e).map(normalize))
    })
  }, [currentEmail])

  useEffect(() => {
    if (!collaborators.length) {
      setCollabSlots({})
      return
    }
    const unsubs = collaborators.map((email) => {
      const r = ref(rtdb, `calendar/users/${emailKey(email)}/slots`)
      return onValue(r, (snap) => {
        const val = snap.val()
        setCollabSlots((prev) => ({
          ...prev,
          [email]: val && typeof val === 'object' ? val : {},
        }))
      })
    })
    return () => unsubs.forEach((u) => u && u())
  }, [collaborators])

  const toggleSlot = (dayKey, hour) => {
    if (!currentEmail) return
    const key = slotKey(dayKey, hour)
    const next = { ...mySlots }
    if (next[key]) delete next[key]
    else next[key] = true
    setMySlots(next)
    set(ref(rtdb, `calendar/users/${emailKey(currentEmail)}/slots`), next).catch((err) =>
      console.error('Failed to save slot:', err),
    )
  }

  const clearAll = () => {
    if (!currentEmail) return
    setMySlots({})
    remove(ref(rtdb, `calendar/users/${emailKey(currentEmail)}/slots`)).catch((err) =>
      console.error('Failed to clear slots:', err),
    )
  }

  const signIn = () => {
    const email = normalize(signInInput)
    if (!email || !email.includes('@')) return
    setCurrentEmail(email)
    setSignInInput('')
  }

  const signOut = () => {
    setCurrentEmail('')
    setMySlots({})
    setCollaborators([])
    setCollabSlots({})
  }

  const persistCollaborators = (list) => {
    set(ref(rtdb, `calendar/users/${emailKey(currentEmail)}/collaborators`), list).catch((err) =>
      console.error('Failed to save collaborators:', err),
    )
  }

  const addCollaborator = () => {
    const email = normalize(collabInput)
    if (!email || !email.includes('@')) return
    if (email === currentEmail || collaborators.includes(email)) {
      setCollabInput('')
      return
    }
    const next = [...collaborators, email]
    setCollaborators(next)
    persistCollaborators(next)
    setCollabInput('')
  }

  const removeCollaborator = (email) => {
    const next = collaborators.filter((e) => e !== email)
    setCollaborators(next)
    persistCollaborators(next)
    setCollabSlots((prev) => {
      const copy = { ...prev }
      delete copy[email]
      return copy
    })
  }

  const shiftWeek = (delta) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + delta * DAYS_IN_WEEK)
    setWeekStart(next)
  }

  const selectedCount = Object.values(mySlots).filter(Boolean).length

  if (!currentEmail) {
    return (
      <section className="component-card" style={styles.card}>
        <h3 style={{ margin: '0 0 8px' }}>Calendar</h3>
        <p style={{ margin: '0 0 12px', color: '#555' }}>
          Sign in with your email to mark your free hours and share with collaborators.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={signInInput}
            onChange={(e) => setSignInInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && signIn()}
            placeholder="you@example.com"
            style={styles.input}
          />
          <button onClick={signIn} style={styles.primaryBtn}>
            Sign in
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="component-card" style={styles.card}>
      <header style={styles.header}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Calendar</h3>
          <div style={{ fontSize: '0.9rem', color: '#555' }}>
            Signed in as <strong>{currentEmail}</strong> · {selectedCount} free slot
            {selectedCount === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={clearAll} style={styles.ghostBtn}>
            Clear all
          </button>
          <button onClick={signOut} style={styles.ghostBtn}>
            Sign out
          </button>
        </div>
      </header>

      <div style={styles.weekNav}>
        <button onClick={() => shiftWeek(-1)} style={styles.navBtn}>
          ← Previous week
        </button>
        <button onClick={() => setWeekStart(new Date())} style={styles.navBtn}>
          This week
        </button>
        <button onClick={() => shiftWeek(1)} style={styles.navBtn}>
          Next week →
        </button>
      </div>

      <CalendarGrid
        days={days}
        slots={mySlots}
        editable
        onToggle={toggleSlot}
      />

      <div style={styles.collabBar}>
        <input
          value={collabInput}
          onChange={(e) => setCollabInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCollaborator()}
          placeholder="add collaborator email"
          style={{ ...styles.input, flex: '0 0 320px' }}
        />
        <button onClick={addCollaborator} style={styles.primaryBtn}>
          Add collaborator
        </button>
        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'}
        </span>
      </div>

      {collaborators.map((email) => (
        <div key={email} style={styles.collabCard}>
          <div style={styles.collabCardHeader}>
            <div>
              <div style={{ fontWeight: 600 }}>{email.split('@')[0]}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{email}</div>
            </div>
            <button onClick={() => removeCollaborator(email)} style={styles.ghostBtn}>
              Remove
            </button>
          </div>
          <CalendarGrid days={days} slots={collabSlots[email] || {}} />
        </div>
      ))}
    </section>
  )
}

function CalendarGrid({ days, slots, editable = false, onToggle }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
        <thead>
          <tr>
            <th style={styles.th}>Time</th>
            {days.map((day) => (
              <th key={day.key} style={{ ...styles.th, textAlign: 'center' }}>
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(({ hour, label }) => (
            <tr key={hour}>
              <td style={styles.timeCell}>{label}</td>
              {days.map((day) => {
                const isFree = !!slots[slotKey(day.key, hour)]
                if (editable) {
                  return (
                    <td key={day.key} style={styles.slotCell}>
                      <button
                        type="button"
                        onClick={() => onToggle(day.key, hour)}
                        aria-pressed={isFree}
                        style={{
                          ...styles.slotBtn,
                          background: isFree ? '#3b82f6' : '#fff',
                          color: isFree ? '#fff' : '#333',
                        }}
                      >
                        {isFree ? 'Free' : 'Busy'}
                      </button>
                    </td>
                  )
                }
                return (
                  <td key={day.key} style={styles.slotCell}>
                    <div
                      style={{
                        ...styles.slotView,
                        background: isFree ? '#10b981' : '#f3f4f6',
                        color: isFree ? '#fff' : '#6b7280',
                      }}
                    >
                      {isFree ? 'Free' : 'Busy'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const styles = {
  card: { padding: 16, minWidth: '100%' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  weekNav: { display: 'flex', gap: 8, marginBottom: 12 },
  navBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
  },
  ghostBtn: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
  },
  input: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '2px solid #ddd',
    background: '#f5f5f5',
  },
  timeCell: {
    padding: '10px 8px',
    borderBottom: '1px solid #eee',
    fontWeight: 500,
    width: 120,
  },
  slotCell: { padding: '6px 4px', borderBottom: '1px solid #eee' },
  slotBtn: {
    width: '100%',
    minHeight: 40,
    border: '1px solid #ccc',
    borderRadius: 8,
    cursor: 'pointer',
  },
  slotView: {
    width: '100%',
    minHeight: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
  },
  collabBar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    margin: '16px 0 12px',
  },
  collabCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    background: '#fbfbfb',
    marginBottom: 16,
  },
  collabCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
}
