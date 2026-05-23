import { rtdb } from './firebase'
import { ref, set, get, onValue, remove, child, serverTimestamp, query, orderByChild } from 'firebase/database'

// Save document content to Realtime Database
export async function saveDocument(projectId, content, email, displayName, clientId) {
  try {
    const docRef = ref(rtdb, `projects/${projectId}/documents/main`)
    await set(docRef, {
      content,
      lastUpdatedBy: displayName || email || 'anonymous',
      lastUpdatedAt: Date.now(),
      updatedAtISO: new Date().toISOString(),
      clientId: clientId || ''
    })
    return true
  } catch (error) {
    console.error('Error saving document to Realtime DB:', error)
    return false
  }
}

// Load document content from Realtime Database
export async function loadDocument(projectId) {
  try {
    const docRef = ref(rtdb, `projects/${projectId}/documents/main/content`)
    const snapshot = await get(docRef)
    if (snapshot.exists()) {
      return snapshot.val() || ''
    }
    return ''
  } catch (error) {
    console.error('Error loading document from Realtime DB:', error)
    return ''
  }
}

// Subscribe to real-time document updates
export function subscribeToDocument(projectId, callback) {
  try {
    const docRef = ref(rtdb, `projects/${projectId}/documents/main`)
    return onValue(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() || {})
      } else {
        callback({})
      }
    }, (error) => {
      console.error('Error subscribing to document:', error)
    })
  } catch (error) {
    console.error('Error setting up document subscription:', error)
    return () => {}
  }
}

// Update user presence in Realtime Database
export async function updatePresence(projectId, email, displayName) {
  if (!email) return
  try {
    const presenceRef = ref(rtdb, `projects/${projectId}/presence/${email.replace(/\./g, '_')}`)
    await set(presenceRef, {
      email,
      name: displayName || '',
      lastSeen: Date.now(),
      activeAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating presence:', error)
  }
}

// Subscribe to presence updates in Realtime Database
export function subscribeToPresence(projectId, callback) {
  try {
    const presenceRef = ref(rtdb, `projects/${projectId}/presence`)
    return onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData = snapshot.val()
        const items = Object.values(presenceData).filter((item) => typeof item === 'object')
        callback(items)
      } else {
        callback([])
      }
    }, (error) => {
      console.error('Error subscribing to presence:', error)
    })
  } catch (error) {
    console.error('Error setting up presence subscription:', error)
    return () => {}
  }
}

// Remove user presence from Realtime Database
export async function removePresence(projectId, email) {
  if (!email) return
  try {
    const presenceRef = ref(rtdb, `projects/${projectId}/presence/${email.replace(/\./g, '_')}`)
    await remove(presenceRef)
  } catch (error) {
    console.error('Error removing presence:', error)
  }
}
