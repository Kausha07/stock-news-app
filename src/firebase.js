import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

// Default Firebase configuration matching your active project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Real-time stock news feed subscription
export const subscribeToStockNews = (callback) => {
  try {
    const q = query(
      collection(db, "stock_news"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      callback(list);
    }, (err) => {
      console.error("Firestore subscription error:", err);
    });
  } catch (e) {
    console.error("Failed to subscribe to Firestore.", e);
  }
  return () => {};
};

// Real-time subscription to tracked stocks list
export const subscribeToTrackedStocks = (callback) => {
  try {
    const q = query(
      collection(db, "tracked_stocks"),
      orderBy("timestamp", "asc")
    );
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      callback(list);
    }, (err) => {
      console.error("Firestore tracked_stocks subscription error:", err);
    });
  } catch (e) {
    console.error("Failed to subscribe to tracked_stocks in Firestore.", e);
  }
  return () => {};
};
