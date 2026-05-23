import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyDDzcXwMJzXBrYfokMTGLG5XLgus5-xusE",
  authDomain: "hackathon26-fdc12.firebaseapp.com",
  projectId: "hackathon26-fdc12",
  storageBucket: "hackathon26-fdc12.firebasestorage.app",
  messagingSenderId: "1031434244925",
  appId: "1:1031434244925:web:c414ff01b5d9a7d6f2ab54",
  databaseURL: "https://hackathon26-fdc12-default-rtdb.firebaseio.com"
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const rtdb = getDatabase(app)
