import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// O'zingizning Firebase config ma'lumotlaringizni qo'ying
const firebaseConfig = {
  apiKey: "AIzaSyAZNQDKsjEFVCr_pe4ErQ5gRDVazAusEa0",
  authDomain: "inventory-f1315.firebaseapp.com",
  projectId: "inventory-f1315",
  storageBucket: "inventory-f1315.firebasestorage.app",
  messagingSenderId: "271690039778",
  appId: "1:271690039778:web:cfd7cad3be480d3f44f9bb"
};

// Firebase initialize
const app = initializeApp(firebaseConfig);

// Firestore database
export const db = getFirestore(app);

export default app;
