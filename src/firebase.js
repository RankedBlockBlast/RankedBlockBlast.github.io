// Firebase auth wrapper — loads the modular SDK from CDN so the static
// GitHub Pages build doesn't need a bundler. The API key is safe to ship
// publicly: it only identifies the project (security comes from rules).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbdL7GFOA3oJv9VvJDXNzATdgi_4bxKpw",
  authDomain: "rankedblockboom.firebaseapp.com",
  projectId: "rankedblockboom",
  storageBucket: "rankedblockboom.firebasestorage.app",
  messagingSenderId: "763624191729",
  appId: "1:763624191729:web:1536a98c6da93315271b50",
  measurementId: "G-M48E49HLQN",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keep the session across reloads/tab closes.
setPersistence(auth, browserLocalPersistence);

export function signUp(email, password, displayName) {
  return createUserWithEmailAndPassword(auth, email, password).then(async (cred) => {
    if (displayName) await updateProfile(cred.user, { displayName });
    return cred;
  });
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return fbSignOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// Map Firebase error codes to short, user-readable strings.
export function authErrorMessage(err) {
  const code = err && err.code;
  switch (code) {
    case "auth/invalid-email": return "That doesn't look like an email.";
    case "auth/missing-password": return "Enter a password.";
    case "auth/weak-password": return "Password too short (min 6 chars).";
    case "auth/email-already-in-use": return "Email already has an account.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Wrong email or password.";
    case "auth/too-many-requests": return "Too many tries. Wait a minute.";
    case "auth/network-request-failed": return "Network error.";
    default: return (err && err.message) || "Sign-in failed.";
  }
}
