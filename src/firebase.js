import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

// Default Firebase configuration matching your active project
const firebaseConfig = {
  apiKey: "AIzaSyCD3sQzPC0TKoNhLBB_d8RLK4RQIsi4-_c",
  authDomain: "arenaflow-798f6.firebaseapp.com",
  projectId: "arenaflow-798f6",
  storageBucket: "arenaflow-798f6.firebasestorage.app",
  messagingSenderId: "861056175882",
  appId: "1:861056175882:web:3e0ec44d795eed869ff4f3",
  measurementId: "G-RYYYVJHJRT"
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
