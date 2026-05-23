import { useState } from 'react'
import './App.css'
import './components/components.css'
import Calendar from './components/Calendar.jsx'
import Messages from './components/Messages.jsx'
import ToDo from './components/To-Do.jsx'
import Sketchpad from './components/Sketchpad.jsx'
import Document from './components/Document.jsx'

function App() {
  const [activeTab, setActiveTab] = useState('document')
  const [projectKey, setProjectKey] = useState(1)
  const [projectState, setProjectState] = useState({})

  const tabDefs = [
    { key: 'calendar', label: 'Calendar' },
    { key: 'document', label: 'Document' },
    { key: 'messages', label: 'Messages' },
    { key: 'sketchpad', label: 'Sketchpad' },
    { key: 'todo', label: 'To-Do' }
  ]

  const handleNewProject = () => {
    // increment projectKey to force remounts and reset internal state in child components
    setProjectKey((k) => k + 1)
    setActiveTab('document')
  }

  const saveModuleState = (moduleKey, data) => {
    setProjectState((prev) => {
      const proj = prev[projectKey] ? { ...prev[projectKey] } : {}
      proj[moduleKey] = data
      return { ...prev, [projectKey]: proj }
    })
  }

  const renderActive = () => {
    const keySuffix = `project-${projectKey}`
    switch (activeTab) {
      case 'calendar':
        return <Calendar key={`calendar-${keySuffix}`} projectKey={projectKey} />
      case 'messages':
        return <Messages key={`messages-${keySuffix}`} projectKey={projectKey} />
      case 'todo':
        return <ToDo key={`todo-${keySuffix}`} projectKey={projectKey} />
      case 'sketchpad':
        return <Sketchpad key={`sketchpad-${keySuffix}`} projectKey={projectKey} />
      case 'document':
      default:
          return (
            <Document
              key={`document-${keySuffix}`}
              projectKey={projectKey}
              content={(projectState[projectKey] && projectState[projectKey].document) || ''}
              onContentChange={(html) => saveModuleState('document', html)}
            />
          )
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

        <button
          type="button"
          className="new-project-button"
          onClick={handleNewProject}
          aria-label="New Project"
        >
          New Project
        </button>
      </header>

      <main className="app-panel" role="tabpanel">
        {renderActive()}
      </main>
    </div>
  )
}

export default App
  