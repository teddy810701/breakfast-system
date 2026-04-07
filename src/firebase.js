import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAfBj728Hs928rZByNebgCkcJoU_MNxFIs",
  authDomain: "my-warm-day-pro.firebaseapp.com",
  projectId: "my-warm-day-pro",
  storageBucket: "my-warm-day-pro.appspot.com",
  messagingSenderId: "409964225413",
  appId: "1:409964225413:web:82fad775514edb08735aec"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);