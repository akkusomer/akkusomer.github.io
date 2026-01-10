import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6IArgdfUJPI0VEZRQkrlRUe_WmSkloI0",
  authDomain: "antalyahal-43d9a.firebaseapp.com",
  projectId: "antalyahal-43d9a",
  storageBucket: "antalyahal-43d9a.firebasestorage.app",
  messagingSenderId: "918495458124",
  appId: "1:918495458124:web:db98fce6b74840a9be15e9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  writeBatch
};
