import { useState } from 'react'
import './App.css'
import './components/components.css'
import Calendar from './components/Calendar.jsx'
import Messages from './components/Messages.jsx'
import Todo from './components/Todo.jsx'
import Sketchpad from './components/Sketchpad.jsx'
import Document from './components/Document.jsx'

const tabs = [
  { key: 'calendar', label: 'Calendar', component: <Calendar /> },
  { key: 'document', label: 'Document', component: <Document /> },
  { key: 'messages', label: 'Messages', component: <Messages /> },
  { key: 'sketchpad', label: 'Sketchpad', component: <Sketchpad /> },
  { key: 'todo', label: 'Todo', component: <Todo /> }
]

function App() {
  const [activeTab, setActiveTab] = useState('document')
  const activeTabData = tabs.find((tab) => tab.key === activeTab) || tabs[0]

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
      </header>

      <main className="app-panel" role="tabpanel">
        {activeTabData.component}
      </main>
    </div>
  )
}

export default App
