import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNSW1VbD3PckbcGpTEl1D4DTu00OqHPmc",
  authDomain: "clinical-pulse-sync.firebaseapp.com",
  projectId: "clinical-pulse-sync",
  storageBucket: "clinical-pulse-sync.firebasestorage.app",
  messagingSenderId: "59170627228",
  appId: "1:59170627228:web:bf81e4ea0f2547b5f65759",
  measurementId: "G-VBRHZQES30"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore database instance
const db = getFirestore(app);

// Initialize Analytics conditionally
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, analytics, db };
