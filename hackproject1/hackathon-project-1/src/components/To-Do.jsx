import React, { useEffect, useMemo, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { rtdb } from '../firebase'
import { loadTodoState, saveTodoState, subscribeToTodoState } from '../firebaseModules'

const storageKey = (projectKey) => `todo_board_data:${projectKey}`

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
    console.error('Failed to read stored identity', error)
  }

  return null
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

function shortNameFromEmail(email) {
  const local = (email || '').split('@')[0] || email || 'Project'
  return local.replace(/[._\-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildMemberRecord(member) {
  if (!member) {
    return null
  }

  const email = normalizeEmail(member.email)
  if (!email) {
    return null
  }

  return {
    email,
    name: typeof member.name === 'string' && member.name.trim() ? member.name.trim() : shortNameFromEmail(email)
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

function initializeStorage(identity, projectKey) {
  const stored = localStorage.getItem(storageKey(projectKey))
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed && Array.isArray(parsed.participants) && Array.isArray(parsed.tasks)) {
        return parsed
      }
    } catch (error) {
      console.error('Failed to parse stored todos', error)
    }
  }

  const currentEmail = normalizeEmail(identity?.email) || 'project-member@local'
  const currentName = identity?.name?.trim() || shortNameFromEmail(currentEmail)

  return {
    participants: [{ email: currentEmail, name: currentName }],
    tasks: [
      { id: 1, text: 'Share the sketchpad with the team', done: false, updatedAt: Date.now() - 1000 * 60 * 5, updatedBy: currentEmail },
      { id: 2, text: 'Review the final ideas before the next sync', done: true, updatedAt: Date.now() - 1000 * 60 * 2, updatedBy: currentEmail },
      { id: 3, text: 'Add notes to the document after the check-in', done: false, updatedAt: Date.now() - 1000 * 60, updatedBy: currentEmail }
    ]
  }
}

function readStoredBoard(projectKey) {
  const stored = localStorage.getItem(storageKey(projectKey))
  if (!stored) {
    return null
  }

  try {
    const parsed = JSON.parse(stored)
    if (!parsed || !Array.isArray(parsed.participants) || !Array.isArray(parsed.tasks)) {
      return null
    }

    return parsed
  } catch (error) {
    console.error('Failed to parse stored todo board', error)
    return null
  }
}

function getParticipantName(participants, email) {
  const participant = participants.find((entry) => entry.email === email)
  return participant?.name || shortNameFromEmail(email)
}

export default function ToDo({ projectKey = 1 }) {
  const [identity, setIdentity] = useState(() => getStoredIdentity())
  const [projectMembers, setProjectMembers] = useState([])
  const [tasks, setTasks] = useState(() => initializeStorage(getStoredIdentity(), projectKey).tasks)
  const [taskText, setTaskText] = useState('')
  const [statusMessage, setStatusMessage] = useState('Everyone in this project is synced automatically.')
  const [isHydrated, setIsHydrated] = useState(false)
  const lastSavedRef = useRef('')

  const participants = useMemo(() => {
    const currentUser = identity
      ? {
          email: normalizeEmail(identity.email),
          name: identity.name?.trim() || shortNameFromEmail(identity.email)
        }
      : null

    return dedupeParticipants([currentUser, ...projectMembers].filter(Boolean))
  }, [identity, projectMembers])

  useEffect(() => {
    const syncIdentity = () => setIdentity(getStoredIdentity())

    syncIdentity()
    window.addEventListener('storage', syncIdentity)

    return () => window.removeEventListener('storage', syncIdentity)
  }, [])

  useEffect(() => {
    const membersRef = ref(rtdb, `projects/project-${projectKey}/members`)

    return onValue(membersRef, (snapshot) => {
      const data = snapshot.val() || {}
      const members = Object.values(data)
        .map(buildMemberRecord)
        .filter(Boolean)

      setProjectMembers(members)
    })
  }, [projectKey])

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      const remoteBoard = await loadTodoState(projectKey)
      const storedBoard = readStoredBoard(projectKey)
      const fallbackBoard = initializeStorage(identity, projectKey)
      const nextBoard = remoteBoard || storedBoard || fallbackBoard

      if (!active) {
        return
      }

      setTasks(nextBoard.tasks)
      localStorage.setItem(storageKey(projectKey), JSON.stringify({ participants, tasks: nextBoard.tasks }))
      lastSavedRef.current = remoteBoard ? JSON.stringify({ participants, tasks: nextBoard.tasks }) : ''
      setIsHydrated(true)
    }

    hydrate()

    const unsubscribe = subscribeToTodoState(projectKey, (remoteBoard) => {
      if (!active) {
        return
      }

      if (!remoteBoard) {
        return
      }

      const remotePayload = JSON.stringify({ participants, tasks: remoteBoard.tasks })
      if (remotePayload === lastSavedRef.current) {
        return
      }

      setTasks(remoteBoard.tasks)
      localStorage.setItem(storageKey(projectKey), remotePayload)
      lastSavedRef.current = remotePayload
      setStatusMessage('Shared list updated from another tab.')
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [identity, participants, projectKey])

  useEffect(() => {
    if (!isHydrated) {
      return undefined
    }

    const payload = JSON.stringify({ participants, tasks })
    if (payload === lastSavedRef.current) {
      return undefined
    }

    lastSavedRef.current = payload
    localStorage.setItem(storageKey(projectKey), payload)

    saveTodoState(projectKey, { participants, tasks })

    return undefined
  }, [isHydrated, participants, tasks, projectKey])

  function addTask() {
    const text = taskText.trim()
    if (!text) {
      return
    }

    const currentEmail = normalizeEmail(identity?.email) || participants[0]?.email || 'project-member@local'

    const nextTask = {
      id: Date.now(),
      text,
      done: false,
      updatedAt: Date.now(),
      updatedBy: currentEmail
    }

    setTasks((current) => [nextTask, ...current])
    setTaskText('')
    setStatusMessage('New task added for the group.')
  }

  function updateTask(id, changes) {
    const currentEmail = normalizeEmail(identity?.email) || participants[0]?.email || 'project-member@local'

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              ...changes,
              updatedAt: Date.now(),
              updatedBy: currentEmail
            }
          : task
      )
    )
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
        .todo-status { font-size:0.9rem; color:var(--muted, #6b7280); }
        .todo-add { display:flex; gap:8px; align-items:center; }
        .todo-add input { flex:1; padding:10px 12px; border-radius:8px; border:1px solid var(--border); background:var(--code-bg); color:var(--text-h); }
        .todo-add button { border:none; border-radius:999px; padding:8px 14px; font-weight:700; cursor:pointer; background:var(--accent); color:white; }
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
      `}</style>

      <div className="todo-header">
        <div className="todo-title">
          <h3>To-Do</h3>
          <p className="todo-muted">Editable task list for your team. Everyone in this project is synced automatically.</p>
        </div>
      </div>

      <div className="todo-participants">
        {participants.map((participant) => (
          <div key={participant.email} className="todo-participant-pill">
            <span className="todo-avatar">{participant.name.charAt(0).toUpperCase()}</span>
            <span>{participant.name}</span>
          </div>
        ))}
      </div>

      <div className="todo-status">{statusMessage}</div>

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
