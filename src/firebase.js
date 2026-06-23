import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC7rISHpwOyy_vMdoLCPf4rvBavowbUlaY",
  authDomain: "kemet-bca36.firebaseapp.com",
  databaseURL: "https://kemet-bca36-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kemet-bca36",
  storageBucket: "kemet-bca36.firebasestorage.app",
  messagingSenderId: "582011689709",
  appId: "1:582011689709:web:18752aa91de7da74934ae4",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);