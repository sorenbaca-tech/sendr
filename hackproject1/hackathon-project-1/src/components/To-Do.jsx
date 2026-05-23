import React, { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'todo_board_data'

function initializeStorage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (error) {
      console.error('Failed to parse stored todos', error)
    }
  }

  return {
    participants: [
      { email: 'you@example.com', name: 'You' },
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' }
    ],
    tasks: [
      { id: 1, text: 'Share the sketchpad with the team', done: false, updatedAt: Date.now() - 1000 * 60 * 5, updatedBy: 'you@example.com' },
      { id: 2, text: 'Review the final ideas before the next sync', done: true, updatedAt: Date.now() - 1000 * 60 * 2, updatedBy: 'alice@example.com' },
      { id: 3, text: 'Add notes to the document after the check-in', done: false, updatedAt: Date.now() - 1000 * 60, updatedBy: 'bob@example.com' }
    ]
  }
}

function shortNameFromEmail(email) {
  const local = email.split('@')[0] || email
  return local.replace(/[._\-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function getParticipantName(participants, email) {
  const participant = participants.find((entry) => entry.email === email)
  return participant?.name || shortNameFromEmail(email)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function ToDo() {
  const initialData = useMemo(() => initializeStorage(), [])
  const [participants, setParticipants] = useState(initialData.participants)
  const [tasks, setTasks] = useState(initialData.tasks)
  const [taskText, setTaskText] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [notification, setNotification] = useState('')
  const [statusMessage, setStatusMessage] = useState('Everyone can edit the shared list in real time.')
  const emailRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ participants, tasks }))
  }, [participants, tasks])

  useEffect(() => {
    const interval = window.setInterval(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {
          return
        }

        const data = JSON.parse(stored)
        const current = JSON.stringify({ participants, tasks })
        if (JSON.stringify(data) !== current) {
          setParticipants(data.participants || participants)
          setTasks(data.tasks || tasks)
          setStatusMessage('Shared list updated from another tab.')
        }
      } catch (error) {
        console.error('Failed to sync todo data', error)
      }
    }, 500)

    return () => window.clearInterval(interval)
  }, [participants, tasks])

  useEffect(() => {
    if (!notification) {
      return undefined
    }

    const timeout = window.setTimeout(() => setNotification(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [notification])

  function addTask() {
    const text = taskText.trim()
    if (!text) {
      return
    }

    const nextTask = {
      id: Date.now(),
      text,
      done: false,
      updatedAt: Date.now(),
      updatedBy: 'you@example.com'
    }

    setTasks((current) => [nextTask, ...current])
    setTaskText('')
    setStatusMessage('New task added for the group.')
  }

  function updateTask(id, changes) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              ...changes,
              updatedAt: Date.now(),
              updatedBy: 'you@example.com'
            }
          : task
      )
    )
  }

  function addParticipant() {
    const email = shareEmail.trim().toLowerCase()
    if (!isValidEmail(email)) {
      if (emailRef.current) {
        emailRef.current.focus()
      }
      return
    }

    if (participants.find((entry) => entry.email === email)) {
      setShareEmail('')
      return
    }

    const participant = { email, name: shortNameFromEmail(email) }
    setParticipants((current) => [...current, participant])
    setShareEmail('')
    setNotification(`Shared with ${participant.name}.`)
    setStatusMessage('Collaborator added to the shared todo board.')
  }

  function removeParticipant(email) {
    setParticipants((current) => current.filter((participant) => participant.email !== email))
    setTasks((current) =>
      current.map((task) =>
        task.updatedBy === email
          ? {
              ...task,
              updatedBy: 'you@example.com'
            }
          : task
      )
    )
    setStatusMessage('Collaborator removed from the board.')
  }

  function removeTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id))
    setStatusMessage('Task removed from the board.')
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      addTask()
    }
  }

  return (
    <section className="component-card todo-wrapper">
      <style>{`
        .todo-wrapper { display:flex; flex-direction:column; gap:12px; min-height:360px; }
        .todo-header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
        .todo-title { display:flex; flex-direction:column; gap:4px; }
        .todo-title h3 { margin:0; }
        .todo-muted { margin:0; color:var(--muted, #6b7280); }
        .todo-participants { display:flex; flex-wrap:wrap; gap:8px; }
        .todo-participant-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:var(--code-bg); border:1px solid var(--border); font-size:0.82rem; }
        .todo-avatar { width:26px; height:26px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; background:var(--accent-bg); color:var(--accent); font-weight:700; }
        .todo-remove-btn { border:1px solid var(--border); border-radius:999px; background:var(--bg); color:var(--text-h); padding:6px 10px; font-size:0.85rem; cursor:pointer; }
        .todo-share { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .todo-share input { padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h); min-width:220px; }
        .todo-share button, .todo-add button { border:none; border-radius:999px; padding:8px 14px; font-weight:700; cursor:pointer; background:var(--accent); color:white; }
        .todo-status { font-size:0.9rem; color:var(--muted, #6b7280); }
        .todo-add { display:flex; gap:8px; align-items:center; }
        .todo-add input { flex:1; padding:10px 12px; border-radius:8px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h); }
        .todo-list { display:flex; flex-direction:column; gap:10px; }
        .todo-item { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:12px; align-items:center; padding:12px; border-radius:12px; border:1px solid var(--border); background:var(--bg); }
        .todo-item input[type='checkbox'] { width:18px; height:18px; accent-color:var(--accent); }
        .todo-item-main { display:flex; flex-direction:column; gap:6px; }
        .todo-item-main input { border:none; background:transparent; color:var(--text-h); font-size:1rem; width:100%; padding:0; }
        .todo-item-main input:focus { outline:none; }
        .todo-item-meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; font-size:0.85rem; color:var(--muted, #6b7280); }
        .todo-item-meta .todo-meta-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; background:var(--code-bg); }
        .todo-item.done input { text-decoration:line-through; color:var(--muted, #6b7280); }
        .todo-empty { padding:18px; border-radius:12px; border:1px dashed var(--border); color:var(--muted, #6b7280); background:var(--bg); }
        .todo-notification { padding:8px 12px; border-radius:8px; background:var(--accent-bg); border:1px solid var(--accent-border); color:var(--accent); font-size:0.9rem; }
      `}</style>

      <div className="todo-header">
        <div className="todo-title">
          <h3>To-Do</h3>
          <p className="todo-muted">Editable task list for your team. Everyone can update the shared board.</p>
        </div>

        <div className="todo-share">
          <input
            ref={emailRef}
            aria-label="Add collaborator email"
            placeholder="Add collaborator email"
            value={shareEmail}
            onChange={(event) => setShareEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addParticipant()
              }
            }}
          />
          <button type="button" onClick={addParticipant}>Share</button>
        </div>
      </div>

      <div className="todo-participants">
        {participants.map((participant) => (
          <div key={participant.email} className="todo-participant-pill">
            <span className="todo-avatar">{participant.name.charAt(0).toUpperCase()}</span>
            <span>{participant.name}</span>
            {participant.email !== 'you@example.com' && (
              <button
                type="button"
                className="todo-remove-btn"
                onClick={() => removeParticipant(participant.email)}
                aria-label={`Remove ${participant.name}`}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="todo-status">{statusMessage}</div>

      {notification && <div className="todo-notification">{notification}</div>}

      <div className="todo-add">
        <input
          aria-label="Add a new task"
          placeholder="Add a new task for the group"
          value={taskText}
          onChange={(event) => setTaskText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" onClick={addTask}>Add task</button>
      </div>

      <div className="todo-list">
        {tasks.length === 0 && <div className="todo-empty">No tasks yet. Add one to get started.</div>}

        {tasks.map((task) => {
          const initials = getParticipantName(participants, task.updatedBy).charAt(0).toUpperCase()
          return (
            <div key={task.id} className={`todo-item ${task.done ? 'done' : ''}`}>
              <input
                type="checkbox"
                aria-label={`Mark ${task.text} as complete`}
                checked={task.done}
                onChange={(event) => updateTask(task.id, { done: event.target.checked })}
              />

              <div className="todo-item-main">
                <input
                  value={task.text}
                  onChange={(event) => updateTask(task.id, { text: event.target.value })}
                  aria-label={`Edit task ${task.text}`}
                />
                <div className="todo-item-meta">
                  <span className="todo-meta-pill">
                    <span className="todo-avatar">{initials}</span>
                    {getParticipantName(participants, task.updatedBy)}
                  </span>
                  <span>{new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{task.done ? 'Completed' : 'In progress'}</span>
                </div>
              </div>

              <span className="todo-meta-pill">Shared</span>
              <button
                type="button"
                className="todo-remove-btn"
                onClick={() => removeTask(task.id)}
                aria-label={`Remove ${task.text}`}
              >
                Remove
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
