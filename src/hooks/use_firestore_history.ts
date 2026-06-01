import { useState } from "react";
import { useData } from "@/context/data_context";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use_toast";

export function useFirestoreHistory() {
  const { data, setData, setColdBlockData } = useData();
  const { toast } = useToast();
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async (target: 'hot' | 'cold' = 'hot') => {
    // Si ya hay datos en memoria, evitamos hacer una petición innecesaria a Firebase
    if (target === 'hot' && data && data.length > 0) return;

    setLoadingHistory(true);
    const collectionName = target === 'cold' ? 'cold_block_records' : 'hot_block_records';
    const setter = target === 'cold' ? setColdBlockData : setData;

    try {
      console.log(`[Firestore] Trayendo histórico de la colección: ${collectionName}`);
      
      const q = query(
        collection(db, collectionName),
        orderBy("uploadedAt", "desc"),
        limit(2000) // Límite prudente para cuidar tus lecturas diarias gratuitas
      );

      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (records.length > 0) {
        setter(records as any);
        toast({
          title: "Datos Sincronizados",
          description: `Se cargaron ${records.length} registros desde Firebase.`,
        });
      } else {
        toast({
          title: "Sin registros",
          description: "No se encontraron datos históricos en la nube.",
        });
      }
    } catch (error) {
      console.error("Error al leer de Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error de sincronización",
        description: "No se pudo recuperar el histórico desde Firebase.",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  return { fetchHistory, loadingHistory };
}