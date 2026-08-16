import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA9ziSPalnwRNSBP1K7Ovx_f0zlwbewn70",
  authDomain: "augmented-dice.firebaseapp.com",
  projectId: "augmented-dice",
  storageBucket: "augmented-dice.firebasestorage.app",
  messagingSenderId: "873917133854",
  appId: "1:873917133854:web:22bd29bf67651529f76a0f",
  measurementId: "G-BB686DQKH3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
