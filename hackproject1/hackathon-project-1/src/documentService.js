import { db } from './firebase'
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore'

// Generate or retrieve a unique project session ID
function getSessionId() {
  let sessionId = sessionStorage.getItem('projectSessionId')
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem('projectSessionId', sessionId)
  }
  return sessionId
}

// Save document content to Firestore
export async function saveDocument(projectId, content) {
  try {
    const sessionId = getSessionId()
    const docRef = doc(db, 'projects', projectId, 'documents', 'main')
    
    await setDoc(docRef, {
      content,
      lastUpdatedBy: sessionId,
      lastUpdatedAt: serverTimestamp(),
      updatedAtLocal: new Date().toISOString()
    }, { merge: true })
    
    return true
  } catch (error) {
    console.error('Error saving document to Firestore:', error)
    return false
  }
}

// Load document content from Firestore
export async function loadDocument(projectId) {
  try {
    const docRef = doc(db, 'projects', projectId, 'documents', 'main')
    const snapshot = await getDoc(docRef)
    
    if (snapshot.exists()) {
      return snapshot.data().content || ''
    }
    return ''
  } catch (error) {
    console.error('Error loading document from Firestore:', error)
    return ''
  }
}

// Subscribe to real-time document updates
export function subscribeToDocument(projectId, callback) {
  try {
    const docRef = doc(db, 'projects', projectId, 'documents', 'main')
    
    const unsubscribe = db.collection('projects').doc(projectId)
      .collection('documents').doc('main')
      .onSnapshot((snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data().content || '')
        }
      }, (error) => {
        console.error('Error subscribing to document:', error)
      })
    
    return unsubscribe
  } catch (error) {
    console.error('Error setting up document subscription:', error)
    return () => {}
  }
}
