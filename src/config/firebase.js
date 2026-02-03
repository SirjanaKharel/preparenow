import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDspbSPs-8VCGSawu-gHSDUXtJMLY95Zgk",
  authDomain: "preparenow13.firebaseapp.com",
  projectId: "preparenow13",
  storageBucket: "preparenow13.firebasestorage.app",
  messagingSenderId: "942935766882",
  appId: "1:942935766882:web:1f4b3a82ec52e384b95e3b",
  measurementId: "G-1BDNBQ9J9K"
};

//Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services (use react-native AsyncStorage for persistence)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;