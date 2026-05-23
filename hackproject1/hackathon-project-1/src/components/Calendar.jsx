import React, { useEffect, useMemo, useState } from 'react'

const hourLabels = Array.from({ length: 12 }, (_, index) => {
  const hour = 8 + index
  const label = hour <= 12 ? `${hour}:00 ${hour === 12 ? 'PM' : 'AM'}` : `${hour - 12}:00 PM`
  return { hour, label }
})

const STORAGE_KEY = 'calendar-selected-slots'

export default function Calendar() {
  const [selectedSlots, setSelectedSlots] = useState(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const days = useMemo(() => {
    const start = new Date()
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
  }, [])

  const otherUsers = useMemo(() => {
    const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = days.map(d => d.key)
    return [
      {
        name: 'Alex',
        availability: new Set([
          `${monday}-9`,
          `${monday}-10`,
          `${tuesday}-14`,
          `${wednesday}-11`,
          `${thursday}-16`,
          `${friday}-10`,
          `${saturday}-9`,
          `${sunday}-13`,
        ]),
      },
      {
        name: 'Riley',
        availability: new Set([
          `${monday}-12`,
          `${tuesday}-11`,
          `${tuesday}-15`,
          `${wednesday}-9`,
          `${thursday}-10`,
          `${friday}-14`,
          `${sunday}-16`,
        ]),
      },
      {
        name: 'Jordan',
        availability: new Set([
          `${monday}-8`,
          `${wednesday}-13`,
          `${wednesday}-14`,
          `${thursday}-9`,
          `${friday}-11`,
          `${friday}-12`,
          `${saturday}-15`,
        ]),
      },
    ]
  }, [days])

  const toggleSlot = (dayKey, hour) => {
    const slotKey = `${dayKey}-${hour}`
    setSelectedSlots(prev => {
      const next = {
        ...prev,
        [slotKey]: !prev[slotKey],
      }

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Ignore write errors in private mode or restricted environments
        }
      }

      return next
    })
  }

  const selectedCount = Object.values(selectedSlots).filter(Boolean).length

  return (
    <section className="component-card" style={{ padding: '16px', minWidth: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Calendar</h3>
        <p style={{ margin: 0 }}>
          Click each hourly slot when you are free. Selected slots become your available project hours.
        </p>
      </div>

      <div style={{ marginBottom: '12px', color: '#333', fontWeight: 500 }}>
        Your selected free slots: {selectedCount}
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
                          cursor: 'pointer',
                          transition: 'background 150ms ease, transform 150ms ease',
                        }}
                        aria-pressed={isSelected}
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
        {otherUsers.map(user => (
          <div
            key={user.name}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '12px',
              background: '#fbfbfb',
            }}
          >
            <div style={{ marginBottom: '10px', fontWeight: 600, color: '#111' }}>
              {user.name}
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
                    <tr key={`${user.name}-${hour}`}>
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
                        const isFree = user.availability.has(`${day.key}-${hour}`)
                        return (
                          <td key={`${user.name}-${day.key}-${hour}`} style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>
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
        ))}
      </div>
    </section>
  )
}
