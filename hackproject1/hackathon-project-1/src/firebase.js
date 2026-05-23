import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDDzcXwMJzXBrYfokMTGLG5XLgus5-xusE",
  authDomain: "hackathon26-fdc12.firebaseapp.com",
  projectId: "hackathon26-fdc12",
  storageBucket: "hackathon26-fdc12.firebasestorage.app",
  messagingSenderId: "1031434244925",
  appId: "1:1031434244925:web:c414ff01b5d9a7d6f2ab54",
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)