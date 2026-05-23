import { useState } from 'react'
import './App.css'
import './components/components.css'
import Calendar from './components/Calendar.jsx'
import Messages from './components/Messages.jsx'
import Todo from './components/Todo.jsx'
import Sketchpad from './components/Sketchpad.jsx'
import Document from './components/Document.jsx'

function App() {
  const [activeTab, setActiveTab] = useState('document')
  const [docKey, setDocKey] = useState(1)

  const tabs = [
    { key: 'calendar', label: 'Calendar', component: <Calendar /> },
    { key: 'document', label: 'Document', component: <Document key={docKey} /> },
    { key: 'messages', label: 'Messages', component: <Messages /> },
    { key: 'sketchpad', label: 'Sketchpad', component: <Sketchpad /> },
    { key: 'todo', label: 'Todo', component: <Todo /> }
  ]

  const activeTabData = tabs.find((tab) => tab.key === activeTab) || tabs[0]

  const handleNewProject = () => {
    // bump the document key to force a remount / fresh document
    setDocKey((k) => k + 1)
    setActiveTab('document')
  }

  return (
    <div className="app-shell">
      <header className="app-tabs" role="tablist" aria-label="App modules tabs">
        {tabs.map((tab) => (
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
        {activeTabData.component}
      </main>
    </div>
  )
}

export default App
  