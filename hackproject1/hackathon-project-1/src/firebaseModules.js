import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

function getProjectId(projectKey) {
  return `project-${projectKey ?? 1}`
}

function getModuleDoc(projectKey, moduleName) {
  return doc(db, 'projects', getProjectId(projectKey), 'modules', moduleName)
}

export async function loadSketchpadState(projectKey) {
  try {
    const snapshot = await getDoc(getModuleDoc(projectKey, 'sketchpad'))

    if (!snapshot.exists()) {
      return ''
    }

    return snapshot.data().dataUrl || ''
  } catch (error) {
    console.error('Failed to load sketchpad state from Firebase:', error)
    return ''
  }
}

export function subscribeToSketchpadState(projectKey, callback) {
  try {
    const unsubscribe = onSnapshot(
      getModuleDoc(projectKey, 'sketchpad'),
      (snapshot) => {
        if (!snapshot.exists()) {
          callback('')
          return
        }

        callback(snapshot.data().dataUrl || '')
      },
      (error) => {
        console.error('Failed to subscribe to sketchpad state:', error)
        callback('')
      }
    )

    return unsubscribe
  } catch (error) {
    console.error('Failed to set up sketchpad subscription:', error)
    return () => {}
  }
}

export async function saveSketchpadState(projectKey, dataUrl) {
  try {
    await setDoc(
      getModuleDoc(projectKey, 'sketchpad'),
      {
        dataUrl: dataUrl || '',
        lastUpdatedAt: serverTimestamp(),
        updatedAtLocal: new Date().toISOString()
      },
      { merge: true }
    )

    return true
  } catch (error) {
    console.error('Failed to save sketchpad state to Firebase:', error)
    return false
  }
}

export async function loadTodoState(projectKey) {
  try {
    const snapshot = await getDoc(getModuleDoc(projectKey, 'todo'))

    if (!snapshot.exists()) {
      return null
    }

    const data = snapshot.data()

    return {
      participants: Array.isArray(data.participants) ? data.participants : [],
      tasks: Array.isArray(data.tasks) ? data.tasks : []
    }
  } catch (error) {
    console.error('Failed to load todo state from Firebase:', error)
    return null
  }
}

export function subscribeToTodoState(projectKey, callback) {
  try {
    const unsubscribe = onSnapshot(
      getModuleDoc(projectKey, 'todo'),
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null)
          return
        }

        const data = snapshot.data()
        callback({
          participants: Array.isArray(data.participants) ? data.participants : [],
          tasks: Array.isArray(data.tasks) ? data.tasks : []
        })
      },
      (error) => {
        console.error('Failed to subscribe to todo state:', error)
        callback(null)
      }
    )

    return unsubscribe
  } catch (error) {
    console.error('Failed to set up todo subscription:', error)
    return () => {}
  }
}

export async function saveTodoState(projectKey, boardData) {
  try {
    await setDoc(
      getModuleDoc(projectKey, 'todo'),
      {
        participants: Array.isArray(boardData.participants) ? boardData.participants : [],
        tasks: Array.isArray(boardData.tasks) ? boardData.tasks : [],
        lastUpdatedAt: serverTimestamp(),
        updatedAtLocal: new Date().toISOString()
      },
      { merge: true }
    )

    return true
  } catch (error) {
    console.error('Failed to save todo state to Firebase:', error)
    return false
  }
}
