import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Asosiy Firebase instance
const app = initializeApp(firebaseConfig);

// Admin xodim qo'shganda current sessionni buzmaslik uchun ikkinchi instance
// (createUserWithEmailAndPassword avtomatik sign-in qiladi — secondaryAuth bilan bunga yo'l qo'ymaymiz)
export const secondaryApp = initializeApp(firebaseConfig, 'Secondary');

export const db          = getFirestore(app);
// Ikkinchi app uchun alohida Firestore instance — secondaryAuth tokeni bilan ishlaydi
export const secondaryDb = getFirestore(secondaryApp);
export const storage     = getStorage(app);
export const auth        = getAuth(app);

export { firebaseConfig };
export default app;
