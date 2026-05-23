import { useEffect, useState } from 'react'
import { get, ref, set, serverTimestamp } from 'firebase/database'
import './App.css'
import './components/components.css'
import { rtdb } from './firebase'
import Calendar from './components/Calendar.jsx'
import Messages from './components/Messages.jsx'
import ToDo from './components/To-Do.jsx'
import Sketchpad from './components/Sketchpad.jsx'
import Document from './components/Document.jsx'

const LS_PROJECT = 'current-project'

const tabDefs = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'document', label: 'Document' },
  { key: 'messages', label: 'Messages' },
  { key: 'sketchpad', label: 'Sketchpad' },
  { key: 'todo', label: 'To-Do' },
]

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function App() {
  const [activeTab, setActiveTab] = useState('document')
  const [project, setProject] = useState(() => {
    try {
      const raw = window.localStorage.getItem(LS_PROJECT)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [projectInput, setProjectInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinNotice, setJoinNotice] = useState('')

  useEffect(() => {
    try {
      if (project) window.localStorage.setItem(LS_PROJECT, JSON.stringify(project))
      else window.localStorage.removeItem(LS_PROJECT)
    } catch {}
  }, [project])

  const handleStartOrJoin = async () => {
    const name = projectInput.trim()
    const slug = slugify(name)
    if (!slug) {
      setJoinError('Please enter a project name.')
      return
    }

    setJoining(true)
    setJoinError('')
    setJoinNotice('')

    try {
      const metaRef = ref(rtdb, `projects/project-${slug}/meta`)
      const snap = await get(metaRef)

      if (snap.exists()) {
        const meta = snap.val()
        setProject({ slug, name: meta.name || name })
        setJoinNotice(`Joined existing project "${meta.name || name}".`)
      } else {
        await set(metaRef, { name, createdAt: serverTimestamp() })
        setProject({ slug, name })
        setJoinNotice(`Created project "${name}".`)
      }
      setProjectInput('')
      setActiveTab('document')
    } catch (err) {
      console.error('Failed to start/join project:', err)
      setJoinError('Could not reach the database. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveProject = () => {
    const confirmed = window.confirm(
      'Leave this project? You can rejoin anytime by entering the same name — your data stays on the server.'
    )
    if (!confirmed) return
    setProject(null)
    setProjectInput('')
    setJoinError('')
    setJoinNotice('')
  }

  if (!project) {
    return (
      <div className="app-shell">
        <main className="app-panel" role="main">
          <section className="component-card" style={landingStyles.card}>
            <h2 style={{ margin: '0 0 8px' }}>Start or join a project</h2>
            <p style={{ margin: '0 0 16px', color: '#555' }}>
              Enter a project name. If someone has already started a project with that name, you'll join them.
            </p>
            <div style={landingStyles.row}>
              <input
                value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !joining && handleStartOrJoin()}
                placeholder="e.g. Hackathon Project"
                style={landingStyles.input}
                autoFocus
              />
              <button
                type="button"
                onClick={handleStartOrJoin}
                disabled={joining}
                style={landingStyles.primaryBtn}
              >
                {joining ? 'Connecting…' : 'Start / Join'}
              </button>
            </div>
            {joinError && <p style={landingStyles.error}>{joinError}</p>}
            {joinNotice && <p style={landingStyles.notice}>{joinNotice}</p>}
          </section>
        </main>
      </div>
    )
  }

  const renderActive = () => {
    const keySuffix = `project-${project.slug}`
    switch (activeTab) {
      case 'calendar':
        return <Calendar key={`calendar-${keySuffix}`} projectKey={project.slug} />
      case 'messages':
        return <Messages key={`messages-${keySuffix}`} projectKey={project.slug} />
      case 'todo':
        return <ToDo key={`todo-${keySuffix}`} projectKey={project.slug} />
      case 'sketchpad':
        return <Sketchpad key={`sketchpad-${keySuffix}`} projectKey={project.slug} />
      case 'document':
      default:
        return <Document key={`document-${keySuffix}`} projectKey={project.slug} />
    }
  }

  return (
    <div className="app-shell">
      <header className="app-tabs" role="tablist" aria-label="App modules tabs">
        {tabDefs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-button ${tab.key === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={tab.key === activeTab}
          >
            {tab.label}
          </button>
        ))}

        <div style={projectChrome.bar}>
          <span style={projectChrome.label}>
            Project: <strong>{project.name}</strong>
          </span>
          <button
            type="button"
            className="new-project-button"
            onClick={handleLeaveProject}
            aria-label="Leave project"
          >
            Leave project
          </button>
        </div>
      </header>

      <main className="app-panel" role="tabpanel">
        {renderActive()}
      </main>
    </div>
  )
}

const landingStyles = {
  card: { padding: 24, maxWidth: 520, margin: '64px auto' },
  row: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: '1rem',
  },
  primaryBtn: {
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  error: { margin: '12px 0 0', color: '#b91c1c' },
  notice: { margin: '12px 0 0', color: '#047857' },
}

const projectChrome = {
  bar: {
    marginLeft: 'auto',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  label: { fontSize: '0.9rem', color: '#374151' },
}

export default App
