import { useEffect, useRef, useState } from 'react'
import {
  saveDocument,
  subscribeToDocument,
  updatePresence,
  subscribeToPresence,
  removePresence
} from '../documentService'

const fontFamilies = [
  { value: 'Arial, sans-serif', label: 'Sans Serif' },
  { value: 'Georgia, serif', label: 'Serif' },
  { value: 'Courier New, monospace', label: 'Monospace' },
  { value: 'Comic Sans MS, cursive', label: 'Cursive' }
]

// Per-tab client id so we can ignore RTDB echoes of our own writes
const CLIENT_ID = `client-${Math.random().toString(36).slice(2, 10)}`

export default function Document({ onContentChange, projectKey }) {
  const editorRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  const hasLoadedRef = useRef(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const [status, setStatus] = useState('Loading…')
  const [currentEmail, setCurrentEmail] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [presence, setPresence] = useState([])
  const [lastUpdatedBy, setLastUpdatedBy] = useState('')
  const projectId = `project-${projectKey || 'default'}`
  const placeholderText =
    'Start typing your project plan here. Use the toolbar to format text, add bullet lists, select a font, and edit with other people in another browser tab.'

  // Restore previously-signed-in email
  useEffect(() => {
    const saved = window.localStorage.getItem('documentEmail') || ''
    if (saved) setCurrentEmail(saved)
  }, [])

  // Single RTDB subscription: handles both initial load and live updates
  useEffect(() => {
    hasLoadedRef.current = false
    const unsubscribe = subscribeToDocument(projectId, (data) => {
      const editor = editorRef.current
      if (!editor) return

      // After we've loaded once, ignore echoes of our own writes
      if (hasLoadedRef.current && data.clientId === CLIENT_ID) {
        setLastUpdatedBy(data.lastUpdatedBy || '')
        return
      }

      const remoteContent = data.content || ''
      if (remoteContent !== editor.innerHTML) {
        const selection = saveSelection(editor)
        editor.innerHTML = remoteContent
        restoreSelection(editor, selection)
      }
      setLastUpdatedBy(data.lastUpdatedBy || '')
      hasLoadedRef.current = true
      setStatus('Saved')
    })

    return () => {
      unsubscribe()
    }
  }, [projectId])

  // Presence: track who's currently in the document
  useEffect(() => {
    if (!currentEmail) {
      setPresence([])
      return
    }
    updatePresence(projectId, currentEmail)
    const unsubscribe = subscribeToPresence(projectId, setPresence)
    const interval = window.setInterval(() => {
      updatePresence(projectId, currentEmail)
    }, 15000)
    const handleUnload = () => removePresence(projectId, currentEmail)
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      unsubscribe()
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
      handleUnload()
    }
  }, [projectId, currentEmail])

  const updateActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline')
    })
  }

  const queueSave = () => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.innerHTML
    if (typeof onContentChange === 'function') onContentChange(html)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setStatus('Saving…')
    saveTimeoutRef.current = setTimeout(async () => {
      const ok = await saveDocument(projectId, html, currentEmail, CLIENT_ID)
      setStatus(ok ? 'Saved' : 'Save failed')
    }, 500)
  }

  const applyCommand = (command, value = null) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('styleWithCSS', false, true)
    document.execCommand(command, false, value)
    updateActiveFormats()
    queueSave()
  }

  const handleInput = () => {
    updateActiveFormats()
    queueSave()
  }

  const handlePaste = (event) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    queueSave()
  }

  const handleFontSize = (event) => {
    const sizeValue = event.target.value
    if (!sizeValue) return
    applyCommand('fontSize', sizeValue === 'normal' ? '3' : sizeValue)
  }

  const handleFontFamily = (event) => {
    applyCommand('fontName', event.target.value)
  }

  const handleCopy = async () => {
    const editor = editorRef.current
    if (!editor) return
    try {
      await navigator.clipboard.writeText(editor.innerText)
      alert('Document text copied to clipboard')
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const signIn = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    window.localStorage.setItem('documentEmail', email)
    setCurrentEmail(email)
    setEmailInput('')
  }

  const signOut = async () => {
    if (currentEmail) await removePresence(projectId, currentEmail)
    setCurrentEmail('')
    window.localStorage.removeItem('documentEmail')
  }

  return (
    <section className="component-card document-card">
      <div className="document-header">
        <div>
          <h3>Project Document</h3>
          <p>
            Write your plan and assign tasks with spell check, formatting, and live
            collaboration in other browser windows.
          </p>
        </div>
        <button type="button" className="doc-action" onClick={handleCopy}>
          Copy Text
        </button>
      </div>

      <div className="document-login-row">
        {!currentEmail ? (
          <div className="document-login">
            <input
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="Enter your email"
              aria-label="Email address"
            />
            <button type="button" onClick={signIn}>
              Join with Email
            </button>
          </div>
        ) : (
          <div className="document-login document-login-active">
            <span>
              Signed in as <strong>{currentEmail}</strong>
            </span>
            <button type="button" onClick={signOut}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      <div className="document-toolbar">
        <button
          type="button"
          onClick={() => applyCommand('bold')}
          aria-label="Bold"
          className={activeFormats.bold ? 'active-format' : ''}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => applyCommand('italic')}
          aria-label="Italic"
          className={activeFormats.italic ? 'active-format' : ''}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => applyCommand('underline')}
          aria-label="Underline"
          className={activeFormats.underline ? 'active-format' : ''}
        >
          Underline
        </button>
        <button type="button" onClick={() => applyCommand('insertUnorderedList')} aria-label="Bullet list">
          Bullet List
        </button>
        <button type="button" onClick={() => applyCommand('insertOrderedList')} aria-label="Numbered list">
          Numbered List
        </button>
        <select defaultValue="normal" onChange={handleFontSize} aria-label="Font size">
          <option value="normal">Font Size</option>
          <option value="4">Large</option>
          <option value="5">XLarge</option>
          <option value="6">Huge</option>
        </select>
        <select defaultValue="Arial, sans-serif" onChange={handleFontFamily} aria-label="Font family">
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => applyCommand('removeFormat')} aria-label="Clear formatting">
          Clear Formatting
        </button>
      </div>

      <div className="document-status">
        {status}
        {currentEmail
          ? ` • ${presence.length} collaborator${presence.length === 1 ? '' : 's'} active`
          : ' • Sign in with your email to collaborate.'}
        {lastUpdatedBy ? <div>Last saved by {lastUpdatedBy}</div> : null}
      </div>

      <div
        ref={editorRef}
        className="document-editor"
        contentEditable
        tabIndex={0}
        spellCheck
        suppressContentEditableWarning
        data-placeholder={placeholderText}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
      />
    </section>
  )
}

// Save the current selection as plain character offsets within `container`
function saveSelection(container) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.startContainer)) return null
  const pre = range.cloneRange()
  pre.selectNodeContents(container)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length
  return { start, end: start + range.toString().length }
}

// Restore a selection saved by saveSelection() after innerHTML was replaced
function restoreSelection(container, saved) {
  if (!saved) return
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  let charIndex = 0
  let started = false
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const next = charIndex + node.length
    if (!started && saved.start >= charIndex && saved.start <= next) {
      range.setStart(node, saved.start - charIndex)
      started = true
    }
    if (started && saved.end >= charIndex && saved.end <= next) {
      range.setEnd(node, saved.end - charIndex)
      selection.removeAllRanges()
      selection.addRange(range)
      return
    }
    charIndex = next
    node = walker.nextNode()
  }
}
