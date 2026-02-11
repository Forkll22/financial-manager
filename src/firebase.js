import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCoXF_wSyXxSXQCF_YJv3bNJnabWysKvXE",
  authDomain: "financial-manager-4dcd6.firebaseapp.com",
  projectId: "financial-manager-4dcd6",
  storageBucket: "financial-manager-4dcd6.firebasestorage.app",
  messagingSenderId: "885909460736",
  appId: "1:885909460736:web:a0d2ed48a383249bbf45e5",
  measurementId: "G-DL388YLLND"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);