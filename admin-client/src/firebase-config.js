
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAyotaULrFbhad2WtAatgVUhzx2erboNeg",
  authDomain: "trivago-5a6d1.firebaseapp.com",
  projectId: "trivago-5a6d1",
  storageBucket: "trivago-5a6d1.firebasestorage.app",
  messagingSenderId: "655740814998",
  appId: "1:655740814998:web:d2270996626df8237224b7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);