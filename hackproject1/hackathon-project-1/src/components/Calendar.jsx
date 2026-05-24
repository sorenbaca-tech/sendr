import React, { useEffect, useMemo, useState } from 'react'
import { onValue, ref, remove, set } from 'firebase/database'
import { rtdb } from '../firebase'

const START_HOUR = 8
const END_HOUR = 20
const DAYS_IN_WEEK = 7
const MAX_RECOMMENDATIONS = 5

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const hour = START_HOUR + i
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour
  return { hour, label: `${display}:00 ${suffix}` }
})

const normalize = (email) => (email || '').trim().toLowerCase()
const emailKey = (email) => normalize(email).replace(/[.#$/[\]]/g, '_')
const slotKey = (dayKey, hour) => `${dayKey}-${hour}`

// Local-date key. Using toISOString() would give the UTC date, which is wrong
// for any timezone west of UTC after late afternoon (and east of UTC before
// dawn).
function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDisplayName(name, email) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed) return trimmed
  const fallback = typeof email === 'string' ? email.split('@')[0] : 'Project member'
  return fallback || 'Project member'
}

function formatHourLabel(hour) {
  const suffix = hour >= 12 && hour < 24 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:00 ${suffix}`
}

function formatRange(startHour, endHour) {
  return `${formatHourLabel(startHour)} – ${formatHourLabel(endHour)}`
}

function buildWeek(from) {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return {
      key: toDateKey(date),
      label: date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    }
  })
}

function slotsPath(projectKey, email) {
  return `projects/project-${projectKey}/calendar/users/${emailKey(email)}/slots`
}

export default function Calendar({ projectKey = 'default', identity = null }) {
  const currentEmail = normalize(identity?.email)
  const currentName = identity?.name || ''

  const [mySlots, setMySlots] = useState({})
  const [collaborators, setCollaborators] = useState([])
  const [collabSlots, setCollabSlots] = useState({})
  const [weekStart, setWeekStart] = useState(() => new Date())

  const days = useMemo(() => buildWeek(weekStart), [weekStart])
  const [currentDayKey, setCurrentDayKey] = useState(() => toDateKey(new Date()))

  useEffect(() => {
    let timeoutId
    const tick = () => setCurrentDayKey(toDateKey(new Date()))

    const scheduleNextMidnight = () => {
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 0)
      timeoutId = window.setTimeout(() => {
        tick()
        scheduleNextMidnight()
      }, nextMidnight.getTime() - now.getTime() + 100)
    }

    const onVisibility = () => {
      if (!document.hidden) tick()
    }

    scheduleNextMidnight()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!currentEmail) {
      setMySlots({})
      return
    }

    const r = ref(rtdb, slotsPath(projectKey, currentEmail))
    return onValue(r, (snap) => {
      const val = snap.val()
      setMySlots(val && typeof val === 'object' ? val : {})
    })
  }, [currentEmail, projectKey])

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
        .filter((member) => member.email && member.email !== currentEmail)

      setCollaborators(members)
    })
  }, [currentEmail, projectKey])

  useEffect(() => {
    if (!collaborators.length) {
      setCollabSlots({})
      return
    }

    const unsubs = collaborators.map((member) => {
      const r = ref(rtdb, slotsPath(projectKey, member.email))
      return onValue(r, (snap) => {
        const val = snap.val()
        setCollabSlots((prev) => ({
          ...prev,
          [member.email]: val && typeof val === 'object' ? val : {},
        }))
      })
    })

    return () => unsubs.forEach((u) => u && u())
  }, [collaborators, projectKey])

  const recommendations = useMemo(() => {
    if (!currentEmail) return []

    const allMembers = [
      { email: currentEmail, name: currentName, slots: mySlots },
      ...collaborators.map((m) => ({
        email: m.email,
        name: m.name,
        slots: collabSlots[m.email] || {},
      })),
    ]

    if (allMembers.length < 2) return []

    const blocks = []
    for (const day of days) {
      let runStart = null
      for (const { hour } of HOURS) {
        const key = slotKey(day.key, hour)
        const everyoneFree = allMembers.every((m) => !!m.slots[key])
        if (everyoneFree) {
          if (runStart === null) runStart = hour
        } else if (runStart !== null) {
          blocks.push({
            dayKey: day.key,
            dayLabel: day.label,
            startHour: runStart,
            endHour: hour,
          })
          runStart = null
        }
      }
      if (runStart !== null) {
        blocks.push({
          dayKey: day.key,
          dayLabel: day.label,
          startHour: runStart,
          endHour: END_HOUR,
        })
      }
    }

    // Prefer longer windows; break ties by chronology (already in order).
    return blocks
      .sort((a, b) => (b.endHour - b.startHour) - (a.endHour - a.startHour))
      .slice(0, MAX_RECOMMENDATIONS)
  }, [days, mySlots, collaborators, collabSlots, currentEmail, currentName])

  const toggleSlot = (dayKey, hour) => {
    if (!currentEmail) return

    const key = slotKey(dayKey, hour)
    const next = { ...mySlots }

    if (next[key]) delete next[key]
    else next[key] = true

    setMySlots(next)
    set(ref(rtdb, slotsPath(projectKey, currentEmail)), next).catch((err) =>
      console.error('Failed to save slot:', err)
    )
  }

  const clearAll = () => {
    if (!currentEmail) return

    setMySlots({})
    remove(ref(rtdb, slotsPath(projectKey, currentEmail))).catch((err) =>
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
        <p style={{ margin: 0, color: '#555' }}>
          Sign in from the project setup screen to use the calendar.
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

      <RecommendedTimes
        recommendations={recommendations}
        memberCount={collaborators.length + 1}
        hasCollaborators={collaborators.length > 0}
      />

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
        todayKey={currentDayKey}
      />

      <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: 12 }}>
        Everyone in this project is included automatically.
      </div>

      {collaborators.length === 0 ? (
        <p style={{ margin: '0 0 12px', color: '#6b7280' }}>
          You're the only member so far. Share the project name to invite others.
        </p>
      ) : null}

      {collaborators.map((member) => (
        <div key={member.email} style={styles.collabCard}>
          <div style={styles.collabCardHeader}>
            <div>
              <div style={{ fontWeight: 600 }}>{getDisplayName(member.name, member.email)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{member.email}</div>
            </div>
          </div>
          <CalendarGrid
            days={days}
            slots={collabSlots[member.email] || {}}
            todayKey={currentDayKey}
          />
        </div>
      ))}
    </section>
  )
}

function RecommendedTimes({ recommendations, memberCount, hasCollaborators }) {
  return (
    <section style={styles.recCard}>
      <div style={styles.recHeader}>
        <div>
          <div style={styles.recTitle}>Recommended meeting times</div>
          <div style={styles.recSubtitle}>
            Windows when all {memberCount} project member{memberCount === 1 ? '' : 's'} are marked free.
          </div>
        </div>
      </div>
      {!hasCollaborators ? (
        <div style={styles.recEmpty}>
          Add at least one other member to see shared availability.
        </div>
      ) : recommendations.length === 0 ? (
        <div style={styles.recEmpty}>
          No fully-overlapping free hours yet. Mark more slots as Free to find common windows.
        </div>
      ) : (
        <ul style={styles.recList}>
          {recommendations.map((block) => {
            const duration = block.endHour - block.startHour
            return (
              <li key={`${block.dayKey}-${block.startHour}`} style={styles.recItem}>
                <span style={styles.recItemDay}>{block.dayLabel}</span>
                <span style={styles.recItemTime}>{formatRange(block.startHour, block.endHour)}</span>
                <span style={styles.recItemDuration}>
                  {duration}h
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CalendarGrid({ days, slots, editable = false, onToggle, todayKey: todayKeyProp }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
        <thead>
          <tr>
            <th style={styles.th}>Time</th>
            {days.map((day) => {
              const isToday = day.key === todayKeyProp
              return (
                <th
                  key={day.key}
                  style={{
                    ...styles.th,
                    textAlign: 'center',
                    background: isToday ? '#dbeafe' : styles.th.background,
                    color: isToday ? '#1d4ed8' : 'inherit',
                  }}
                >
                  {day.label}
                  {isToday && <div style={styles.todayPill}>Today</div>}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(({ hour, label }) => (
            <tr key={hour}>
              <td style={styles.timeCell}>{label}</td>
              {days.map((day) => {
                const isFree = !!slots[slotKey(day.key, hour)]
                const isToday = day.key === todayKeyProp
                const cellStyle = isToday
                  ? { ...styles.slotCell, background: '#eff6ff' }
                  : styles.slotCell

                if (editable) {
                  return (
                    <td key={day.key} style={cellStyle}>
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
                  <td key={day.key} style={cellStyle}>
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
  todayPill: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#1d4ed8',
    marginTop: 2,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
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
    minHeight: 40,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    border: '1px solid #e5e7eb',
  },
  collabCard: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12 },
  collabCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recCard: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  recHeader: { marginBottom: 8 },
  recTitle: { fontWeight: 600, color: '#1e3a8a' },
  recSubtitle: { fontSize: '0.85rem', color: '#1e40af' },
  recEmpty: { fontSize: '0.9rem', color: '#374151' },
  recList: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 },
  recItem: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr auto',
    alignItems: 'center',
    gap: 12,
    padding: '8px 10px',
    background: '#fff',
    border: '1px solid #bfdbfe',
    borderRadius: 8,
  },
  recItemDay: { fontWeight: 600, color: '#111827' },
  recItemTime: { color: '#1f2937' },
  recItemDuration: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#1d4ed8',
    background: '#dbeafe',
    padding: '2px 8px',
    borderRadius: 999,
  },
}
