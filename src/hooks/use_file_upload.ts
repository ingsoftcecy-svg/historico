import { useState, useRef, useEffect } from "react";
import { useData } from "@/context/data_context";
import { processDbfFile, mergeBatchRecords } from "@/utils/dbf_processor";
import { useToast } from "@/hooks/use_toast";
import { useAuth } from "@/context/auth_context";
import { BatchRecord } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch } from "firebase/firestore";

async function saveRecordsToFirestore(
  records: BatchRecord[],
  target: 'hot' | 'cold',
  fileNames: string[],
  uploaderId?: string | null
) {
  if (records.length === 0) return;
  const collectionName = target === 'cold' ? 'cold_block_records' : 'hot_block_records';
  const chunkSize = 400;
  console.log(`Saving ${records.length} records to Firestore collection '${collectionName}'`, { uploaderId, fileNames });

  for (let i = 0; i < records.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = records.slice(i, i + chunkSize);

    chunk.forEach((record) => {
      const docRef = doc(collection(db, collectionName));
      
      // Remove undefined fields to avoid Firestore errors
      const cleanRecord = Object.fromEntries(
        Object.entries(record).filter(([_, value]) => value !== undefined)
      );

      batch.set(docRef, {
        ...cleanRecord,
        batchId: record.CHARG_NR,
        machine: record.TEILANL_GRUPO,
        uploadedAt: new Date().toISOString(),
        uploadSource: 'file_upload',
        uploadTarget: target,
        sourceFiles: fileNames,
        uploaderId: uploaderId || null,
      });
    });

    try {
      await batch.commit();
      console.log(`Firestore batch committed for records ${i} to ${i + chunk.length - 1}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`Firestore batch commit failed for records ${i} to ${i + chunk.length - 1}:`, error);
      throw error;
    }
  }
}

export function useFileUpload(target: 'hot' | 'cold' = 'hot') {
  const { setData, setColdBlockData } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic limit based on target - Increased to 100 for cold block as requested
  const MAX_FILES = target === 'cold' ? 100 : 4;
  const setter = target === 'cold' ? setColdBlockData : setData;

  const clearProgressInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearProgressInterval();
  }, []);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast({
        variant: "destructive",
        title: "Exceso de archivos",
        description: `Solo puedes subir un máximo de ${MAX_FILES} archivos a la vez para esta sección.`,
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return 90 + Math.random() * 2;
        return Math.min(prev + Math.random() * 15, 90);
      });
    }, 300);

    try {
      let combinedData: BatchRecord[] = [];
      let successCount = 0;
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (ext !== 'dbf') {
          throw new Error(`Archivo no soportado: ${file.name}. Solo se admiten archivos .dbf`);
        }
        
        const fileData = await processDbfFile(file);
        if (fileData && fileData.length > 0) {
          combinedData = [...combinedData, ...fileData];
          successCount++;
        }
      }

      clearProgressInterval();
      setUploadProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (combinedData.length > 0) {
        const uniqueData = mergeBatchRecords(combinedData);
        setter(uniqueData);

        try {
          await saveRecordsToFirestore(uniqueData, target, files.map((file) => file.name), user?.uid);
          toast({
            title: "¡Histórico subido y guardado!",
            description: `Se procesaron ${successCount} archivo(s) y se guardaron ${uniqueData.length} lotes en Firebase.`,
            className: "bg-primary text-primary-foreground border-none",
          });
        } catch (firestoreError: any) {
          console.error("Error guardando en Firestore:", firestoreError);
          toast({
            variant: "destructive",
            title: "Error al guardar histórico",
            description: firestoreError?.message || "Los datos se procesaron localmente, pero la sincronización con Firebase falló.",
          });
        }
      } else {
        throw new Error("No se encontraron datos válidos en los archivos.");
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error en el procesamiento",
        description:
          "Uno o más archivos no son válidos o no tienen el formato esperado.",
      });
    } finally {
      clearProgressInterval();
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return { loading, uploadProgress, processFiles, maxFiles: MAX_FILES };
}
