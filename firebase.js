// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVPDkW5PvEnW75QF5YBw04qPfs9Ng0i-o",
  authDomain: "moumen-7b216.firebaseapp.com",
  projectId: "moumen-7b216",
  storageBucket: "moumen-7b216.appspot.com",
  messagingSenderId: "891367913014",
  appId: "1:891367913014:web:8f6681bc03907206308a97"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const dbCloud = getFirestore(app);

export const fb = {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
};
