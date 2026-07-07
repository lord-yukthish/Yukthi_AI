import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";

// Read Firebase client credentials from the generated configuration file or default fallback
const firebaseConfig = {
  projectId: "stoked-antenna-rr5vm",
  appId: "1:149226503821:web:4da3602383dbc1191e6cc4",
  apiKey: "AIzaSyAWKCKe07TpYeaVc71hK1oKpe-xUDMKC0U",
  authDomain: "stoked-antenna-rr5vm.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-yukthiai-e98e4580-c1e9-4ee3-be99-73caaee9b815",
  storageBucket: "stoked-antenna-rr5vm.firebasestorage.app",
  messagingSenderId: "149226503821"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with custom databaseId if configured
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

export {
  GoogleAuthProvider,
  EmailAuthProvider,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch
};
