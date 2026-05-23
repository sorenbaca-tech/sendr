
import React, { useEffect, useMemo, useState } from 'react'
import { rtdb } from '../firebase'
import { ref, onValue, set } from 'firebase/database'

const hourLabels = Array.from({ length: 12 }, (_, index) => {
  const hour = 8 + index
  const label = hour <= 12 ? `${hour}:00 ${hour === 12 ? 'PM' : 'AM'}` : `${hour - 12}:00 PM`
  return { hour, label }
})

const CURRENT_EMAIL_KEY = 'calendar-current-email'
const COLLABS_KEY = 'calendar-collaborators'

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function getUserSlotsRef(email) {
  return ref(rtdb, `calendar/users/${normalizeEmail(email)}/slots`)
}

function getCollaboratorsRef() {
  return ref(rtdb, 'calendar/metadata/collaborators/emails')
}

export default function Calendar() {
  const [currentEmail, setCurrentEmail] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.localStorage.getItem(CURRENT_EMAIL_KEY) || ''
    } catch {
      return ''
    }
  })

  const [selectedSlots, setSelectedSlots] = useState({})
  const [collaborators, setCollaborators] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(COLLABS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const [collabAvailability, setCollabAvailability] = useState({})
  const [today, setToday] = useState(() => new Date())

  const days = useMemo(() => {
    const start = new Date(today)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = date.toISOString().slice(0, 10)
      const label = date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      return { key, label }
    })
  }, [today])

  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    const timeout = window.setTimeout(() => setToday(new Date()), nextMidnight.getTime() - now.getTime())

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const collabRef = getCollaboratorsRef()
    const unsubscribe = onValue(collabRef, snapshot => {
      const data = snapshot.val()
      if (!Array.isArray(data)) {
        setCollaborators([])
        return
      }
      setCollaborators(data.map(normalizeEmail))
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CURRENT_EMAIL_KEY, currentEmail)
      } catch {}
    }

    if (!currentEmail) {
      setSelectedSlots({})
      return
    }

    const userRef = getUserSlotsRef(currentEmail)
    const unsubscribe = onValue(userRef, snapshot => {
      const slots = snapshot.exists() ? snapshot.val() || {} : {}
      setSelectedSlots(slots)
    })

    return unsubscribe
  }, [currentEmail])

  useEffect(() => {
    const unsubs = collaborators.map(email => {
      const userRef = getUserSlotsRef(email)
      return onValue(userRef, snapshot => {
        const slots = snapshot.exists() ? snapshot.val() || {} : {}
        setCollabAvailability(prev => ({ ...prev, [email]: slots }))
      })
    })

    return () => unsubs.forEach(unsub => unsub())
  }, [collaborators])

  const updateCollaboratorsDoc = async (emails) => {
    const collabRef = getCollaboratorsRef()
    try {
      await set(collabRef, emails)
    } catch {}
  }

  const toggleSlot = (dayKey, hour) => {
    if (!currentEmail) return
    const slotKey = `${dayKey}-${hour}`
    setSelectedSlots(prev => {
      const next = { ...prev, [slotKey]: !prev[slotKey] }
      set(getUserSlotsRef(currentEmail), next).catch(() => {})
      return next
    })
  }

  const clearAll = () => {
    if (!currentEmail) return
    setSelectedSlots({})
    set(getUserSlotsRef(currentEmail), {}).catch(() => {})
  }

  const signIn = (email) => {
    setCurrentEmail(normalizeEmail(email))
  }

  const signOut = () => {
    setCurrentEmail('')
  }

  const addCollaborator = async (email) => {
    const normalized = normalizeEmail(email)
    if (!normalized) return
    if (collaborators.includes(normalized) || normalized === currentEmail) return
    const next = [...collaborators, normalized]
    setCollaborators(next)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLABS_KEY, JSON.stringify(next))
      }
    } catch {}
    await updateCollaboratorsDoc(next)
  }

  const removeCollaborator = async (email) => {
    const next = collaborators.filter(e => e !== email)
    setCollaborators(next)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLABS_KEY, JSON.stringify(next))
      }
    } catch {}
    await updateCollaboratorsDoc(next)
    setCollabAvailability(prev => {
      const nextAvailability = { ...prev }
      delete nextAvailability[email]
      return nextAvailability
    })
  }

  const selectedCount = Object.values(selectedSlots).filter(Boolean).length

  const [signInInput, setSignInInput] = useState('')
  const [collabInput, setCollabInput] = useState('')

  return (
    <section className="component-card" style={{ padding: '16px', minWidth: '100%' }}>
      <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>Calendar</h3>
          <p style={{ margin: 0 }}>
            Sign in with your email to save and share availability.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {currentEmail ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '0.95rem', color: '#111' }}>{currentEmail}</div>
              <button onClick={signOut} style={{ padding: '6px 10px', borderRadius: 8 }}>Sign out</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={signInInput}
                onChange={e => setSignInInput(e.target.value)}
                placeholder="you@example.com"
                style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
              <button
                onClick={() => { signIn(signInInput); setSignInInput('') }}
                style={{ padding: '6px 10px', borderRadius: 8 }}
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ color: '#333', fontWeight: 500 }}>
          Your selected free slots: {selectedCount}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={clearAll}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#111827',
              cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          value={collabInput}
          onChange={e => setCollabInput(e.target.value)}
          placeholder="add collaborator email"
          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db', flex: '0 0 320px' }}
        />
        <button onClick={() => { addCollaborator(collabInput); setCollabInput('') }} style={{ padding: '6px 10px', borderRadius: 8 }}>
          Add collaborator
        </button>
        <div style={{ marginLeft: 'auto', color: '#555' }}>{collaborators.length} collaborators</div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '720px' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 8px',
                  borderBottom: '2px solid #ddd',
                  background: '#f5f5f5',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                Time
              </th>
              {days.map(day => (
                <th
                  key={day.key}
                  style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    borderBottom: '2px solid #ddd',
                    background: '#f5f5f5',
                  }}
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hourLabels.map(({ hour, label }) => (
              <tr key={hour}>
                <td
                  style={{
                    padding: '10px 8px',
                    borderBottom: '1px solid #eee',
                    fontWeight: 500,
                    width: '120px',
                  }}
                >
                  {label}
                </td>
                {days.map(day => {
                  const slotKey = `${day.key}-${hour}`
                  const isSelected = !!selectedSlots[slotKey]
                  return (
                    <td key={slotKey} style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>
                      <button
                        type="button"
                        onClick={() => toggleSlot(day.key, hour)}
                        style={{
                          width: '100%',
                          minHeight: '40px',
                          border: '1px solid #ccc',
                          borderRadius: '8px',
                          background: isSelected ? '#3b82f6' : '#fff',
                          color: isSelected ? '#fff' : '#333',
                          cursor: currentEmail ? 'pointer' : 'not-allowed',
                          opacity: currentEmail ? 1 : 0.7,
                        }}
                        aria-pressed={isSelected}
                        disabled={!currentEmail}
                      >
                        {isSelected ? 'Free' : 'Busy'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Collaborators' calendars</h4>
        <p style={{ margin: 0, color: '#555' }}>
          View other team members' free hours across the same week.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '18px' }}>
        {collaborators.map(email => {
          const availability = collabAvailability[email] || {}
          const displayName = email.split('@')[0]
          return (
            <div
              key={email}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '12px',
                background: '#fbfbfb',
              }}
            >
              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, color: '#111' }}>{displayName}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{email}</div>
                  <button onClick={() => removeCollaborator(email)} style={{ padding: '6px 8px', borderRadius: 8 }}>Remove</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '720px' }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '8px 6px',
                          borderBottom: '2px solid #ddd',
                          background: '#f9fafb',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        Time
                      </th>
                      {days.map(day => (
                        <th
                          key={day.key}
                          style={{
                            textAlign: 'center',
                            padding: '8px 6px',
                            borderBottom: '2px solid #ddd',
                            background: '#f9fafb',
                          }}
                        >
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hourLabels.map(({ hour, label }) => (
                      <tr key={`${email}-${hour}`}>
                        <td
                          style={{
                            padding: '8px 6px',
                            borderBottom: '1px solid #eee',
                            fontWeight: 500,
                            width: '120px',
                          }}
                        >
                          {label}
                        </td>
                        {days.map(day => {
                          const isFree = !!availability[`${day.key}-${hour}`]
                          return (
                            <td key={`${email}-${day.key}-${hour}`} style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>
                              <div
                                style={{
                                  width: '100%',
                                  minHeight: '36px',
                                  borderRadius: '8px',
                                  background: isFree ? '#10b981' : '#f3f4f6',
                                  color: isFree ? '#fff' : '#6b7280',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.85rem',
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
            </div>
          )
        })}
      </div>
    </section>
  )
}
