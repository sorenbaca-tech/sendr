import { get, onValue, ref, set } from 'firebase/database'
import { rtdb } from './firebase'

function getProjectId(projectKey) {
  return `project-${projectKey ?? 1}`
}

function getSketchpadRef(projectKey) {
  return ref(rtdb, `projects/${getProjectId(projectKey)}/modules/sketchpad`)
}

function getTodoRef(projectKey) {
  return ref(rtdb, `projects/${getProjectId(projectKey)}/modules/todo`)
}

export async function loadSketchpadState(projectKey) {
  try {
    const snapshot = await get(getSketchpadRef(projectKey))

    if (!snapshot.exists()) {
      return ''
    }

    const value = snapshot.val()
    return typeof value === 'string' ? value : value?.dataUrl || ''
  } catch (error) {
    console.error('Failed to load sketchpad state from Realtime Database:', error)
    return ''
  }
}

export function subscribeToSketchpadState(projectKey, callback) {
  try {
    return onValue(
      getSketchpadRef(projectKey),
      (snapshot) => {
        if (!snapshot.exists()) {
          callback('')
          return
        }

        const value = snapshot.val()
        callback(typeof value === 'string' ? value : value?.dataUrl || '')
      },
      (error) => {
        console.error('Failed to subscribe to sketchpad state:', error)
        callback('')
      }
    )
  } catch (error) {
    console.error('Failed to set up sketchpad subscription:', error)
    return () => {}
  }
}

export async function saveSketchpadState(projectKey, dataUrl) {
  try {
    await set(getSketchpadRef(projectKey), {
      dataUrl: dataUrl || '',
      lastUpdatedAt: Date.now(),
      updatedAtLocal: new Date().toISOString()
    })

    return true
  } catch (error) {
    console.error('Failed to save sketchpad state to Realtime Database:', error)
    return false
  }
}

export async function loadTodoState(projectKey) {
  try {
    const snapshot = await get(getTodoRef(projectKey))

    if (!snapshot.exists()) {
      return null
    }

    const data = snapshot.val()

    if (!data || !Array.isArray(data.participants) || !Array.isArray(data.tasks)) {
      return null
    }

    return {
      participants: data.participants,
      tasks: data.tasks
    }
  } catch (error) {
    console.error('Failed to load todo state from Realtime Database:', error)
    return null
  }
}

export function subscribeToTodoState(projectKey, callback) {
  try {
    return onValue(
      getTodoRef(projectKey),
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null)
          return
        }

        const data = snapshot.val()

        if (!data || !Array.isArray(data.participants) || !Array.isArray(data.tasks)) {
          callback(null)
          return
        }

        callback({
          participants: data.participants,
          tasks: data.tasks
        })
      },
      (error) => {
        console.error('Failed to subscribe to todo state:', error)
        callback(null)
      }
    )
  } catch (error) {
    console.error('Failed to set up todo subscription:', error)
    return () => {}
  }
}

export async function saveTodoState(projectKey, boardData) {
  try {
    await set(getTodoRef(projectKey), {
      participants: Array.isArray(boardData.participants) ? boardData.participants : [],
      tasks: Array.isArray(boardData.tasks) ? boardData.tasks : [],
      lastUpdatedAt: Date.now(),
      updatedAtLocal: new Date().toISOString()
    })

    return true
  } catch (error) {
    console.error('Failed to save todo state to Realtime Database:', error)
    return false
  }
}
