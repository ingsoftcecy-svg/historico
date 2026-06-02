import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// linea encargada de inicializar Firestore con cache persistente
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (import.meta.env.DEV) {
  const missingConfigFields = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  console.log("Firebase config loaded:", {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    appId: firebaseConfig.appId,
  });
  if (missingConfigFields.length > 0) {
    console.warn("Firebase config missing values:", missingConfigFields);
  }
}

const app = initializeApp(firebaseConfig);

if (import.meta.env.DEV) {
  console.log("Firebase app name:", app.name);
  console.log("Firebase app options:", app.options);
}


export const analytics = getAnalytics(app);

//inicializamos Firestore con cache persistente para mejorar el rendimiento y reducir costos de lectura
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() // Soporte para múltiples pestañas abiertas
  })
}, "brewinsights");

export const auth = getAuth(app);
