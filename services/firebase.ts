import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get, update, push, runTransaction, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCccUWrRIPAS0gmYIVTK6l-6TQjLijtLM",
  authDomain: "energiatranscriptor.firebaseapp.com",
  projectId: "energiatranscriptor",
  storageBucket: "energiatranscriptor.firebasestorage.app",
  messagingSenderId: "693488374508",
  appId: "1:693488374508:web:60b9e12c521e713a818bc9",
  measurementId: "G-HN3PGRYJLF"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Export db functions for easy use
export { ref, onValue, set, get, update, push, runTransaction, Database };