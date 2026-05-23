import React, { useEffect, useMemo, useState } from 'react'
import { onValue, ref, remove, set } from 'firebase/database'
import { rtdb } from '../firebase'

const START_HOUR = 8
const END_HOUR = 20
const DAYS_IN_WEEK = 7

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const hour = START_HOUR + i
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour
  return { hour, label: `${display}:00 ${suffix}` }
})

const normalize = (email) => (email || '').trim().toLowerCase()
const emailKey = (email) => normalize(email).replace(/[.#$/[\]]/g, '_')
const slotKey = (dayKey, hour) => `${dayKey}-${hour}`

function getStoredIdentity() {
  try {
    const stored = localStorage.getItem('user-identity')
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed.email === 'string') {
      return parsed
    }
  } catch (error) {
    console.error('Failed to parse shared identity', error)
  }

  return null
}

function getDisplayName(name, email) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed) {
    return trimmed
  }

  const fallback = typeof email === 'string' ? email.split('@')[0] : 'Project member'
  return fallback || 'Project member'
}

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

export default function Calendar({ projectKey = 1 }) {
  const [currentEmail, setCurrentEmail] = useState(() => getStoredIdentity()?.email || '')
  const [currentName, setCurrentName] = useState(() => getStoredIdentity()?.name || '')
  const [mySlots, setMySlots] = useState({})
  const [collaborators, setCollaborators] = useState([])
  const [collabSlots, setCollabSlots] = useState({})
  const [weekStart, setWeekStart] = useState(() => new Date())

  const days = useMemo(() => buildWeek(weekStart), [weekStart])

  useEffect(() => {
    const identity = getStoredIdentity()
    if (identity?.email) {
      setCurrentEmail(identity.email)
    }
    if (identity?.name) {
      setCurrentName(identity.name)
    }
  }, [])

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
    const membersRef = ref(rtdb, `projects/project-${projectKey}/members`)

    return onValue(membersRef, (snapshot) => {
      const data = snapshot.val() || {}
      const members = Object.values(data)
        .filter((member) => member && typeof member === 'object')
        .map((member) => ({
          email: normalize(member.email),
          name: typeof member.name === 'string' ? member.name.trim() : '',
        }))
        .filter((member) => member.email)
        .filter((member) => member.email !== normalize(currentEmail))

      setCollaborators(members)
    })
  }, [currentEmail, projectKey])

  useEffect(() => {
    if (!collaborators.length) {
      setCollabSlots({})
      return
    }

    const unsubs = collaborators.map((member) => {
      const r = ref(rtdb, `calendar/users/${emailKey(member.email)}/slots`)
      return onValue(r, (snap) => {
        const val = snap.val()
        setCollabSlots((prev) => ({
          ...prev,
          [member.email]: val && typeof val === 'object' ? val : {},
        }))
      })
    })

    return () => unsubs.forEach((u) => u && u())
  }, [collaborators])

  const toggleSlot = (dayKey, hour) => {
    if (!currentEmail) {
      return
    }

    const key = slotKey(dayKey, hour)
    const next = { ...mySlots }

    if (next[key]) {
      delete next[key]
    } else {
      next[key] = true
    }

    setMySlots(next)
    set(ref(rtdb, `calendar/users/${emailKey(currentEmail)}/slots`), next).catch((err) =>
      console.error('Failed to save slot:', err)
    )
  }

  const clearAll = () => {
    if (!currentEmail) {
      return
    }

    setMySlots({})
    remove(ref(rtdb, `calendar/users/${emailKey(currentEmail)}/slots`)).catch((err) =>
      console.error('Failed to clear slots:', err)
    )
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
          Waiting for your project identity to load so your calendar can sync automatically.
        </p>
      </section>
    )
  }

  return (
    <section className="component-card" style={styles.card}>
      <header style={styles.header}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Calendar</h3>
          <div style={{ fontSize: '0.9rem', color: '#555' }}>
            Syncing with <strong>{getDisplayName(currentName, currentEmail)}</strong> · {selectedCount} free slot
            {selectedCount === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={clearAll} style={styles.ghostBtn}>
          Clear all
        </button>
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

      <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: 12 }}>
        Everyone in this project is included automatically.
      </div>

      {collaborators.length === 0 ? (
        <p style={{ margin: '0 0 12px', color: '#6b7280' }}>Waiting for project members to appear.</p>
      ) : null}

      {collaborators.map((member) => (
        <div key={member.email} style={styles.collabCard}>
          <div style={styles.collabCardHeader}>
            <div>
              <div style={{ fontWeight: 600 }}>{getDisplayName(member.name, member.email)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{member.email}</div>
            </div>
          </div>
          <CalendarGrid days={days} slots={collabSlots[member.email] || {}} />
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
  ghostBtn: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
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
  slotView: { width: '100%', minHeight: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', border: '1px solid #e5e7eb' },
  collabCard: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12 },
  collabCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
}
