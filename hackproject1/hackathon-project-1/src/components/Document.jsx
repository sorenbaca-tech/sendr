import { useEffect, useRef, useState } from 'react'
import { saveDocument, loadDocument } from '../documentService'

const fontSizeLookup = {
  1: '10px',
  2: '12px',
  3: '16px',
  4: '18px',
  5: '24px',
  6: '32px',
  7: '48px'
}

const fontFamilies = [
  { value: 'Arial, sans-serif', label: 'Sans Serif' },
  { value: 'Georgia, serif', label: 'Serif' },
  { value: 'Courier New, monospace', label: 'Monospace' },
  { value: 'Comic Sans MS, cursive', label: 'Cursive' }
]

function createChannel(onMessage) {
  if (typeof BroadcastChannel === 'undefined') {
    return null
  }

  const channel = new BroadcastChannel('document-collab')
  channel.onmessage = (event) => {
    const payload = event.data
    if (payload?.type === 'SYNC_DOCUMENT' && typeof payload.html === 'string') {
      onMessage(payload.html, payload.sender)
    }
  }
  return channel
}

export default function Document({ content = '', onContentChange, projectKey }) {
  const editorRef = useRef(null)
  const channelRef = useRef(null)
  const savedSelectionRef = useRef(null)
  const senderIdRef = useRef(`tab-${Math.random().toString(36).slice(2, 10)}`)
  const saveTimeoutRef = useRef(null)
  const [documentHtml, setDocumentHtml] = useState(content || '')
  const [isConnected, setIsConnected] = useState(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const [isSaving, setIsSaving] = useState(false)
  const [projectId] = useState(() => `project-${projectKey || 'default'}`)

  const saveSelection = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.startContainer) && !editor.contains(range.endContainer)) {
      return
    }

    savedSelectionRef.current = range.cloneRange()
  }

  const restoreSelection = () => {
    const range = savedSelectionRef.current
    const selection = window.getSelection()
    if (!range || !selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const updateActiveFormats = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) {
      setActiveFormats({ bold: false, italic: false, underline: false })
      return
    }

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.startContainer) && !editor.contains(range.endContainer)) {
      setActiveFormats({ bold: false, italic: false, underline: false })
      return
    }

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline')
    })
  }

  useEffect(() => {
    const channel = createChannel((html, senderId) => {
      if (senderId === senderIdRef.current) return
      const editor = editorRef.current
      if (!editor) return
      if (html !== editor.innerHTML) {
        editor.innerHTML = html
        setDocumentHtml(html)
        if (typeof onContentChange === 'function') {
          onContentChange(html)
        }
      }
      setIsConnected(true)
    })

    if (channel) {
      channelRef.current = channel
      setIsConnected(true)
    }

    return () => {
      channel?.close()
    }
  }, [onContentChange])

  // Load document from Firestore on mount or projectKey change
  useEffect(() => {
    const loadFromFirestore = async () => {
      try {
        const firebaseContent = await loadDocument(projectId)
        if (firebaseContent) {
          const editor = editorRef.current
          if (editor && firebaseContent !== editor.innerHTML) {
            editor.innerHTML = firebaseContent
            setDocumentHtml(firebaseContent)
            if (typeof onContentChange === 'function') {
              onContentChange(firebaseContent)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load document from Firestore:', error)
      }
    }

    loadFromFirestore()
  }, [projectId, onContentChange])

  useEffect(() => {
    const editor = editorRef.current
    if (editor && content && content !== editor.innerHTML) {
      editor.innerHTML = content
      setDocumentHtml(content)
    }
  }, [content])

  const broadcastContent = (html) => {
    const channel = channelRef.current
    if (!channel) return
    channel.postMessage({
      type: 'SYNC_DOCUMENT',
      html,
      sender: senderIdRef.current
    })
  }

  const updateContent = () => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.innerHTML
    setDocumentHtml(html)
    broadcastContent(html)
    if (typeof onContentChange === 'function') {
      onContentChange(html)
    }

    // Debounce Firestore save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setIsSaving(true)
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(projectId, html)
        .then(() => setIsSaving(false))
        .catch((err) => {
          console.error('Failed to save to Firestore:', err)
          setIsSaving(false)
        })
    }, 1000) // Save 1 second after user stops typing
  }

  const applyCommand = (command, value = null) => {
    restoreSelection()
    document.execCommand('styleWithCSS', false, true)
    document.execCommand(command, false, value)
    normalizeFontTags()
    updateContent()
    editorRef.current?.focus()
    updateActiveFormats()
  }

  const normalizeFontTags = () => {
    const editor = editorRef.current
    if (!editor) return
    const fonts = editor.querySelectorAll('font[size]')
    fonts.forEach((font) => {
      const size = font.getAttribute('size')
      const span = document.createElement('span')
      span.style.fontSize = fontSizeLookup[size] || '16px'
      span.innerHTML = font.innerHTML
      font.replaceWith(span)
    })
  }

  const handleFontSize = (event) => {
    const sizeValue = event.target.value
    if (!sizeValue) return
    const sizeKey = sizeValue === 'normal' ? '3' : sizeValue
    applyCommand('fontSize', sizeKey)
  }

  const handleFontFamily = (event) => {
    const font = event.target.value
    applyCommand('fontName', font)
  }

  const handleInput = () => {
    updateContent()
    updateActiveFormats()
  }

  const handlePaste = (event) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
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

  useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveFormats()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

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

      <div className="document-toolbar" onMouseDown={saveSelection}>
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
        {isSaving ? (
          'Saving to Firebase...'
        ) : isConnected ? (
          'Collaborative editing active • Saved to Firebase'
        ) : (
          'Collaboration available in modern browsers'
        )}
      </div>

      <div
        ref={editorRef}
        className="document-editor"
        contentEditable
        spellCheck
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
      >
        {content || 'Start typing your project plan here. Use the toolbar to format text, add bullet lists, select a font, and edit with other people in another browser tab.'}
      </div>
    </section>
  )
}
