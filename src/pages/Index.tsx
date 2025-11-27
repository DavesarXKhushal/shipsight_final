import { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, LogOut } from "lucide-react";
import logoUrl from "../../logo.png";
import { Button } from "@/components/ui/button";
import { CameraPreview, CameraPreviewRef } from "@/components/CameraPreview";
import { BarcodeInput } from "@/components/BarcodeInput";
import { RecordingControls, LogEntry, RecordingControlsRef } from "@/components/RecordingControls";
import { SessionLog } from "@/components/SessionLog";
import { beepStart, beepStop } from "@/lib/beep";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

type LogState = { version: number; updatedAt: string; barcodes: string[]; events: LogEntry[] };

interface IndexProps {
  onLogout?: () => void;
}

const Index = ({ onLogout }: IndexProps) => {
  const [barcode, setBarcode] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentRecordingBarcode, setCurrentRecordingBarcode] = useState<string>("");
  const [outputFolder, setOutputFolder] = useState<string>("");
  const [dirHandle, setDirHandle] = useState<any | null>(null);
  const [monthDirHandle, setMonthDirHandle] = useState<any | null>(null);
  const [log, setLog] = useState<LogState>({ version: 1, updatedAt: new Date().toISOString(), barcodes: [], events: [] });
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const controlsRef = useRef<RecordingControlsRef | null>(null);
  const cameraRef = useRef<CameraPreviewRef | null>(null);
  const switchInProgressRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<Date | null>(null);
  const navigate = useNavigate();
  const [showReversePanel, setShowReversePanel] = useState(false);
  const reverseOrder = ["Front", "Back", "Left", "Right", "Top", "Bottom"] as const;
  const [reverseIndex, setReverseIndex] = useState(0);
  const [reverseCaptured, setReverseCaptured] = useState<Record<string, boolean>>({});
  const [reverseImages, setReverseImages] = useState<Record<string, string>>({});
  const [showQualityAlert, setShowQualityAlert] = useState(false);
  const [reverseZipBlob, setReverseZipBlob] = useState<Blob | null>(null);
  const [reverseZipName, setReverseZipName] = useState<string | null>(null);
  const [recordMode, setRecordMode] = useState<"forward" | "reverse">("forward");
  const [folderInitDone, setFolderInitDone] = useState(false);

  const excelFileName = "session.xlsx";
  const [monthName, setMonthName] = useState<string>("");
  const computeMonthName = (): string => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());

  const idbOpen = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("shipsight-store", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const saveDirHandleIDB = async (handle: any) => {
    try {
      const db = await idbOpen();
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "outputDir");
      await new Promise((res, rej) => { tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error); });
      db.close();
    } catch {}
  };

  const loadDirHandleIDB = async (): Promise<any | null> => {
    try {
      const db = await idbOpen();
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("outputDir");
      const handle: any = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
      db.close();
      return handle ?? null;
    } catch {
      return null;
    }
  };

  const ensureExcelFile = async (directoryHandle: any) => {
    try {
      const fh = await directoryHandle.getFileHandle(excelFileName, { create: false });
      const f = await fh.getFile();
      const size = f.size;
      if (size > 0) return;
    } catch {}
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Date", "StartTime", "EndTime", "OrderID", "Mode", "File"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Log");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileHandle = await directoryHandle.getFileHandle(excelFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    await writable.close();
  };

  const readExcelRows = async (directoryHandle: any): Promise<{ Date: string; StartTime: string; EndTime: string; OrderID: string; Mode: string; File: string }[]> => {
    try {
      const fileHandle = await directoryHandle.getFileHandle(excelFileName, { create: true });
      const file = await fileHandle.getFile();
      const buf = await file.arrayBuffer();
      if (!buf || (file.size ?? 0) === 0) return [];
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws) as any[];
      return rows.map((r) => ({ Date: String(r["Date"] ?? ""), StartTime: String(r["StartTime"] ?? ""), EndTime: String(r["EndTime"] ?? ""), OrderID: String(r["OrderID"] ?? ""), Mode: String(r["Mode"] ?? ""), File: String(r["File"] ?? "") }));
    } catch {
      return [];
    }
  };

  const upsertExcelRow = async (directoryHandleParam: any, orderId: string, mode: "forward" | "reverse", updates: { start?: string; end?: string; file?: string; date?: string }) => {
    try {
      const handle = directoryHandleParam ?? dirHandle;
      if (!handle) return;
      await ensureExcelFile(handle);
      const fileHandle = await handle.getFileHandle(excelFileName, { create: true });
      const file = await fileHandle.getFile();
      const buf = await file.arrayBuffer();
      let wb: XLSX.WorkBook;
      if (buf && (file.size ?? 0) > 0) {
        wb = XLSX.read(buf, { type: "array" });
      } else {
        wb = XLSX.utils.book_new();
        const wsInit = XLSX.utils.aoa_to_sheet([["Date", "StartTime", "EndTime", "OrderID", "Mode", "File"]]);
        XLSX.utils.book_append_sheet(wb, wsInit, "Log");
      }
      const sheetName = wb.SheetNames[0] ?? "Log";
      let ws = wb.Sheets[sheetName];
      if (!ws) {
        ws = XLSX.utils.aoa_to_sheet([["Date", "StartTime", "EndTime", "OrderID", "Mode", "File"]]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      const existingRows = XLSX.utils.sheet_to_json(ws) as any[];
      const idx = existingRows.findIndex((r) => String(r["OrderID"]).trim() === orderId.trim() && String(r["Mode"]).trim().toLowerCase() === mode);
      const now = new Date();
      const d = updates.date ?? now.toLocaleDateString();
      const rowUpdate: any = {
        Date: d,
        StartTime: updates.start ?? "",
        EndTime: updates.end ?? "",
        OrderID: orderId,
        Mode: mode,
        File: updates.file ?? "",
      };
      if (idx >= 0) {
        const current = existingRows[idx];
        existingRows[idx] = {
          Date: current["Date"] || rowUpdate.Date,
          StartTime: rowUpdate.StartTime || current["StartTime"] || "",
          EndTime: rowUpdate.EndTime || current["EndTime"] || "",
          OrderID: current["OrderID"] || orderId,
          Mode: current["Mode"] || mode,
          File: rowUpdate.File || current["File"] || "",
        };
      } else {
        existingRows.push(rowUpdate);
      }
      const newWs = XLSX.utils.json_to_sheet(existingRows, { header: ["Date", "StartTime", "EndTime", "OrderID", "Mode", "File"] });
      wb.Sheets[sheetName] = newWs;
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const writable = await fileHandle.createWritable();
      await writable.write(new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      await writable.close();
    } catch {}
  };

  useEffect(() => {
    const restore = async () => {
      try {
        const h = await loadDirHandleIDB();
        if (!h) { setFolderInitDone(true); return; }
        if (typeof h.requestPermission === "function") {
          const perm = await h.requestPermission({ mode: "readwrite" });
          if (perm !== "granted") { setFolderInitDone(true); return; }
        }
        setDirHandle(h);
        setOutputFolder(h.name);
        const mName = computeMonthName();
        setMonthName(mName);
        let mHandle: any = null;
        try { mHandle = await h.getDirectoryHandle(mName, { create: true }); } catch {}
        if (mHandle) setMonthDirHandle(mHandle);
        try {
          localStorage.setItem('shipsight:lastOutputFolderName', h.name);
          document.cookie = `shipsight_last_folder=${encodeURIComponent(h.name)}; path=/; max-age=31536000`;
        } catch {}
        try {
          const base = mHandle ?? h;
          await base.getDirectoryHandle("forward", { create: true });
          await base.getDirectoryHandle("reverse", { create: true });
        } catch {}
        await ensureExcelFile(mHandle ?? h);
        await loadExcelLog(mHandle ?? h);
        setLogEntries(prev => [...prev, { time: new Date().toLocaleTimeString(), status: "info", message: `Output folder restored: ${h.name}` }]);
      } finally {
        setFolderInitDone(true);
      }
    };
    restore();
  }, []);

  const handleCapture = async (tag: string, opts?: { retake?: boolean }) => {
    // Enforce sequential capture order
    const nextTag = reverseOrder[reverseIndex];
    if (showReversePanel && !opts?.retake && tag !== nextTag) {
      toast.error(`Please capture in order. Next: ${nextTag}`);
      return;
    }
    // Require barcode scanned
    if (!barcode.trim()) {
      toast.error("Scan barcode before capturing photos");
      return;
    }
    // Require output folder selected
    if (!dirHandle) {
      toast.error("Select output folder before capturing photos");
      return;
    }
    // Block duplicate reverse photos for a barcode already used in reverse mode (unless part of current session)
    if (showReversePanel) {
      const code = barcode.trim();
      try {
        const used = await isOrderUsedInExcel(code, "reverse");
        const active = (recordMode === "reverse" && currentRecordingBarcode === code) || Object.keys(reverseImages).length > 0;
        if (used && !active) {
          toast.error("Barcode already used in reverse; photos not allowed");
          setLogEntries(prev => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              status: "error",
              message: `Reverse photos blocked for duplicate barcode: ${code}`,
            },
          ]);
          return;
        }
        if (!used && Object.keys(reverseImages).length === 0 && !opts?.retake) {
          await upsertExcelRow(monthDirHandle ?? dirHandle, code, "reverse", { date: new Date().toLocaleDateString(), start: new Date().toLocaleTimeString() });
        }
      } catch { void 0; }
    }
    
    const dataUrl = cameraRef.current?.captureSnapshot();
    if (!dataUrl) {
      toast.error("Unable to capture snapshot");
      return;
    }
    const code = barcode.trim();
    setLogEntries(prev => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        status: "success",
        message: opts?.retake ? "Retake snapshot captured" : "Snapshot captured",
        tag,
        imageUrl: dataUrl,
      },
    ]);
    toast.success(`${opts?.retake ? 'Retake ' : ''}${tag} photo captured`);

    // Store image for ZIP export
    setReverseImages(prev => ({ ...prev, [tag]: dataUrl }));

    if (showReversePanel) {
      setReverseCaptured(prev => ({ ...prev, [tag]: true }));
      if (!opts?.retake) {
        setReverseIndex((i) => Math.min(i + 1, reverseOrder.length));
      }
      if (!opts?.retake && reverseIndex + 1 >= reverseOrder.length) {
        await completeReverseCycle();
      }
    }
  };

  const saveSnapshotToFolder = async (code: string, tag: string, dataUrl: string): Promise<string | null> => {
    try {
      const baseDir = monthDirHandle ?? dirHandle;
      if (!baseDir) return null;
      const mime = dataUrl.substring(5, dataUrl.indexOf(";")); // e.g., image/jpeg or image/png
      const ext = mime.includes("jpeg") ? "jpg" : mime.includes("png") ? "png" : "jpg";
      const fname = `${code}_${tag}.${ext}`;
      const fileHandle = await baseDir.getFileHandle(fname, { create: true });
      const writable = await fileHandle.createWritable();
      // Convert dataUrl to Blob
      const blob = await (await fetch(dataUrl)).blob();
      await writable.write(blob);
      await writable.close();
      return fname;
    } catch (e) {
      console.error("Error saving snapshot", e);
      return null;
    }
  };

  const dataUrlToUint8 = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const completeReverseCycle = async () => {
    toast.success("Reverse photo capture complete");
    if (isRecording && controlsRef.current) {
      await controlsRef.current.stop();
    }
    try {
      const zip = new JSZip();
      const code = barcode.trim();
      for (const tag of reverseOrder) {
        const img = reverseImages[tag];
        if (img) {
          const bytes = dataUrlToUint8(img);
          zip.file(`${code}_${tag}.jpg`, bytes);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const fname = `${code}-reverse.zip`;
      setReverseZipBlob(blob);
      setReverseZipName(fname);
      setLogEntries(prev => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          status: "success",
          message: `Reverse photos ready: ${fname}`,
        },
      ]);
      // Show quality confirmation alert
      setShowQualityAlert(true);
    } catch (e) {
      console.error("ZIP generation error", e);
      toast.error("Failed to prepare reverse photos ZIP");
      setLogEntries(prev => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          status: "error",
          message: `Failed to prepare reverse photos ZIP`,
        },
      ]);
    }
  };

  const saveZipToFolder = async (blob: Blob, fname: string) => {
    const baseDir = monthDirHandle ?? dirHandle;
    if (!baseDir) return false;
    try {
      const reverseDir = await baseDir.getDirectoryHandle("reverse", { create: true });
      const fileHandle = await reverseDir.getFileHandle(fname, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      console.error("Save ZIP failed", e);
      return false;
    }
  };

  const downloadBlob = (blob: Blob, fname: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleQualityChoice = async (choice: "fine" | "email") => {
    if (!reverseZipBlob || !reverseZipName) {
      toast.error("ZIP not ready");
      return;
    }
    // Save strictly to the selected folder, no fallback download
    if (!dirHandle) {
      toast.error("Select output folder to save ZIP");
      return;
    }
    const saved = await saveZipToFolder(reverseZipBlob, reverseZipName);
    setLogEntries(prev => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        status: saved ? "success" : "error",
        message: saved ? `ZIP saved: ${reverseZipName}` : `Failed to save ZIP`,
      },
    ]);
    try {
      const code = barcode.trim();
      if (saved) {
        await upsertExcelRow(monthDirHandle ?? dirHandle, code, "reverse", { end: new Date().toLocaleTimeString() });
      }
    } catch { void 0; }

    if (choice === "email") {
      const code = barcode.trim();
      const subject = encodeURIComponent(`Reverse photos for ${code}`);
      const body = encodeURIComponent(`Please find the ZIP file (${reverseZipName}). If not attached automatically, it has been downloaded on your device.`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      toast.message("Email compose opened");
      setLogEntries(prev => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          status: "info",
          message: `Email compose opened for ${code}`,
        },
      ]);
    }

    // Reset for next cycle
    setShowQualityAlert(false);
    setReverseIndex(0);
    setReverseCaptured({});
    setReverseImages({});
    setReverseZipBlob(null);
    setReverseZipName(null);
  };

  const toggleReversePanel = async () => {
    const opening = !showReversePanel;
    if (opening && isRecording && recordMode === "forward") {
      toast.error("Reverse capture disabled during forward recording");
      return;
    }
    if (opening) {
      setReverseIndex(0);
      setReverseCaptured({});
      setReverseImages({});
      setRecordMode("reverse");
    }
    setShowReversePanel(opening);
    if (!opening) {
      if (!isRecording || recordMode !== "reverse") {
        setRecordMode("forward");
      }
    }
  };

  // Timer effect to track elapsed time during recording
  useEffect(() => {
    if (isRecording && recordingStartTimeRef.current) {
      timerIntervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - recordingStartTimeRef.current!.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (!isRecording) {
        setElapsedTime(0);
        recordingStartTimeRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording]);

  const handleFolderSelect = async () => {
    try {
      // @ts-ignore - showDirectoryPicker is not fully supported in TS yet
      const directoryHandle = await window.showDirectoryPicker();
      setDirHandle(directoryHandle);
      setOutputFolder(directoryHandle.name);
      const mName = computeMonthName();
      setMonthName(mName);
      let mHandle: any = null;
      try { mHandle = await directoryHandle.getDirectoryHandle(mName, { create: true }); } catch {}
      if (mHandle) setMonthDirHandle(mHandle);
      try {
        localStorage.setItem('shipsight:lastOutputFolderName', directoryHandle.name);
        document.cookie = `shipsight_last_folder=${encodeURIComponent(directoryHandle.name)}; path=/; max-age=31536000`;
      } catch {}
      await saveDirHandleIDB(directoryHandle);
      try {
        const base = mHandle ?? directoryHandle;
        await base.getDirectoryHandle("forward", { create: true });
        await base.getDirectoryHandle("reverse", { create: true });
      } catch { void 0; }

      await ensureExcelFile(mHandle ?? directoryHandle);
      await loadExcelLog(mHandle ?? directoryHandle);
      toast.success(`Output folder selected: ${directoryHandle.name}`);
      setLogEntries(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        status: "info",
        message: `Output folder set to: ${directoryHandle.name}`
      }]);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("Failed to select folder");
      }
    }
  };

  const loadExcelLog = async (directoryHandle: any) => {
    try {
      await ensureExcelFile(directoryHandle);
      const rows = await readExcelRows(directoryHandle);
      const usedBarcodes: string[] = [];
      const historicalEntries: LogEntry[] = [];
      for (const r of rows) {
        const code = r.OrderID?.trim();
        if (code) {
          if (!usedBarcodes.includes(code)) usedBarcodes.push(code);
          const modeInfo = r.Mode || "forward";
          const timesInfo = `${r.StartTime || ""}${r.EndTime ? ` → ${r.EndTime}` : ""}`.trim();
          const fileInfo = r.File ? ` — ${r.File}` : "";
          historicalEntries.push({ time: r.StartTime || new Date().toLocaleTimeString(), status: "info", message: `Order ${code}: ${modeInfo}${fileInfo}${timesInfo ? ` (${timesInfo})` : ""}` });
        }
      }
      if (historicalEntries.length > 0) {
        setLogEntries(prev => [...historicalEntries, ...prev]);
      }
      setLog({ version: 1, updatedAt: new Date().toISOString(), barcodes: usedBarcodes, events: historicalEntries });
    } catch (e) {
      console.error("Failed to load session.xlsx", e);
      toast.error("Unable to access Excel log file");
    }
  };

  const isOrderUsedInExcel = async (code: string, mode: "forward" | "reverse"): Promise<boolean> => {
    try {
      const base = monthDirHandle ?? dirHandle;
      if (!base) return false;
      const rows = await readExcelRows(base);
      return rows.some((r) => String(r.OrderID).trim() === code.trim() && String(r.Mode).trim().toLowerCase() === mode);
    } catch {
      return false;
    }
  };

  const reserveBarcode = async (code: string, mode: "forward" | "reverse"): Promise<boolean> => {
    const normalized = code.trim();
    if (!normalized) {
      toast.error("Barcode is empty");
      return false;
    }
    let usedForward = false;
    let usedReverse = false;
    try {
      if (dirHandle) {
        const base = monthDirHandle ?? dirHandle;
        const rows = await readExcelRows(base);
        usedForward = rows.some((r) => String(r.OrderID).trim() === normalized && String(r.Mode).trim().toLowerCase() === "forward");
        usedReverse = rows.some((r) => String(r.OrderID).trim() === normalized && String(r.Mode).trim().toLowerCase() === "reverse");
      }
    } catch {}
    if (mode === "forward" && usedForward) {
      toast.error("Barcode already used for forward recording");
      return false;
    }
    if (mode === "reverse" && usedReverse) {
      toast.error("Barcode already used for reverse recording");
      return false;
    }
    const updated: LogState = { version: 1, updatedAt: new Date().toISOString(), barcodes: [...log.barcodes, normalized], events: log.events };
    setLog(updated);
    
    setLogEntries(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      status: "info",
      message: `Reserved barcode: ${normalized}`
    }]);
    return true;
  };

  const handleSubmitBarcode = async (code: string): Promise<boolean> => {
    const normalized = code.trim();
    if (!normalized) return false;

    // If currently recording and submitting the SAME barcode: stop only, no restart
    if (isRecording && controlsRef.current && normalized === currentRecordingBarcode && normalized.length > 0) {
      await controlsRef.current.stop();
      toast.error("Same barcode entered; recording stopped and not restarted.");
      return false;
    }

    if (!outputFolder) {
      toast.error("Please select an output folder first");
      return false;
    }

    if (isRecording) {
      const ok = await reserveBarcode(normalized, recordMode);
      if (!ok) {
        // Keep current recording running on duplicate or invalid
        return false;
      }
      if (controlsRef.current) {
        await controlsRef.current.stop();
        const started = await controlsRef.current.startWithBarcode(normalized);
        if (started) setCurrentRecordingBarcode(normalized);
        return started;
      }
      return false;
    }

    const ok = await reserveBarcode(normalized, recordMode);
    if (!ok) return false;
    if (controlsRef.current) {
      const started = await controlsRef.current.startWithBarcode(normalized);
      if (started) setCurrentRecordingBarcode(normalized);
      return started;
    }
    return false;
  };

  const handleSubmitForwardBarcode = async (code: string): Promise<boolean> => {
    const normalized = code.trim();
    if (!normalized) return false;
    if (showReversePanel) setShowReversePanel(false);
    setRecordMode("forward");
    if (isRecording && controlsRef.current && normalized === currentRecordingBarcode && normalized.length > 0) {
      await controlsRef.current.stop();
      toast.error("Same barcode entered; recording stopped.");
      return false;
    }
    if (!outputFolder) {
      toast.error("Please select an output folder first");
      return false;
    }
    if (isRecording) {
      const ok = await reserveBarcode(normalized, "forward");
      if (!ok) return false;
      if (controlsRef.current) {
        await controlsRef.current.stop();
        const started = await controlsRef.current.startWithBarcode(normalized);
        if (started) setCurrentRecordingBarcode(normalized);
        return started;
      }
      return false;
    }
    const ok = await reserveBarcode(normalized, "forward");
    if (!ok) return false;
    if (controlsRef.current) {
      const started = await controlsRef.current.startWithBarcode(normalized);
      if (started) setCurrentRecordingBarcode(normalized);
      return started;
    }
    return false;
  };


  const downloadLogFile = async () => {
    try {
      if (dirHandle) {
        const baseDir = monthDirHandle ?? dirHandle;
        await ensureExcelFile(baseDir);
        const fileHandle = await baseDir.getFileHandle(excelFileName, { create: true });
        const file = await fileHandle.getFile();
        const buf = await file.arrayBuffer();
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session.xlsx`;
        a.click();
      } else {
        const wb = XLSX.utils.book_new();
        const header = [["Date", "StartTime", "EndTime", "OrderID", "Mode"]];
        const grouped: Record<string, { Date: string; StartTime: string; EndTime: string; OrderID: string; Mode: string }> = {};
        for (const e of log.events) {
          const mOrder = e.message.match(/barcode:\s*(\S+)/i) || e.message.match(/Order\s+(\S+):/i);
          const order = mOrder ? mOrder[1] : "";
          const mode = e.message.toLowerCase().includes("reverse") ? "reverse" : "forward";
          const key = `${order}|${mode}`;
          if (!grouped[key]) grouped[key] = { Date: new Date().toLocaleDateString(), StartTime: "", EndTime: "", OrderID: order, Mode: mode };
          if (/Started recording for barcode:/i.test(e.message)) {
            grouped[key].StartTime = e.time;
            grouped[key].Date = new Date().toLocaleDateString();
          }
          if (e.message.startsWith("Recording saved:")) {
            grouped[key].EndTime = e.time;
          }
          if (e.message.startsWith("ZIP saved:")) {
            grouped[key].EndTime = e.time;
          }
        }
        const rows = Object.values(grouped).map((r) => [r.Date, r.StartTime, r.EndTime, r.OrderID, r.Mode]);
        const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, "Log");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session.xlsx`;
        a.click();
      }
    } catch (e) {
      console.error("Download log failed", e);
      toast.error("Failed to download Excel log file");
    }
  };

  const handleLogEntry = (entry: LogEntry) => {
    setLogEntries(prev => [...prev, entry]);
    const updated: LogState = { ...log, events: [...log.events, entry], updatedAt: new Date().toISOString() };
    setLog(updated);
    const iso = new Date().toISOString();
    // Simplified log lines: START / STOP / SAVED only
    if (/Started recording for barcode:/i.test(entry.message)) {
      const m = entry.message.match(/Started recording for barcode:\s*(\S+)/i);
      if (m) {
        setCurrentRecordingBarcode(m[1]);
        upsertExcelRow(monthDirHandle ?? dirHandle, m[1], recordMode, { date: new Date().toLocaleDateString(), start: entry.time }).catch(() => {});
      }
      return;
    }
    if (/Recording stopped for barcode:/i.test(entry.message)) {
      const m = entry.message.match(/Recording stopped for barcode:\s*(\S+)/i);
      if (m) {
        upsertExcelRow(monthDirHandle ?? dirHandle, m[1], recordMode, { end: entry.time }).catch(() => {});
      }
      return;
    }
    if (entry.message.startsWith("Recording saved:")) {
      const fname = entry.message.replace("Recording saved:", "").trim();
      const bc = fname.replace(/\.(mp4|webm)$/i, "").trim();
      upsertExcelRow(monthDirHandle ?? dirHandle, bc, recordMode, { end: entry.time }).catch(() => {});
      return;
    }
  };

  // Removed auto-switch on typing; recording actions now happen only on Enter or Start button

  return (
    <>
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1e] via-[#0d1117] to-[#050810]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[var(--glass-border)] bg-[var(--glass-light)] backdrop-blur-2xl sticky top-0 z-50">
          <div className="container mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--shadow-lg)] flex items-center justify-center cursor-pointer"
                  onClick={() => navigate("/dashboard")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/dashboard"); }}
                  role="button"
                  tabIndex={0}
                  aria-label="Go to Dashboard"
                >
                  <img src={logoUrl} alt="ShipSight Logo" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    ShipSight
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    One platform for all your shipments
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="glass-white"
                  className="gap-2"
                  onClick={() => navigate("/dashboard")}
                >
                  <span>Dashboard</span>
                </Button>
                <Button
                  variant="glass-white"
                  onClick={handleFolderSelect}
                  className="gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {outputFolder || "Select Folder"}
                  </span>
                </Button>
                
                <Button
                  variant="glass-white"
                  onClick={onLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Logout
                  </span>
                </Button>
              </div>
              {/* Removed header log button per request; moved beside Session Log */}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-6">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Left Column - Barcode above Camera & Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Barcode Input (moved above camera) with integrated recording controls */}
              <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-5 shadow-[var(--shadow-lg)]">
                <BarcodeInput 
                  onBarcodeChange={setBarcode} 
                  onSubmitBarcode={handleSubmitBarcode}
                  isRecording={isRecording}
                />
                <div className="mt-4">
                  <RecordingControls 
                    ref={controlsRef}
                    barcode={barcode}
                    onRecordingStateChange={(rec) => { 
                      setIsRecording(rec); 
                      if (rec) {
                        recordingStartTimeRef.current = new Date();
                        void beepStart();
                        if (recordMode === "forward" && showReversePanel) {
                          setShowReversePanel(false);
                        }
                      } else {
                        setCurrentRecordingBarcode("");
                        void beepStop();
                      }
                    }}
                    onLogEntry={handleLogEntry}
                    enabled={Boolean(outputFolder)}
                    onReserveBarcode={(code) => reserveBarcode(code, recordMode)}
                    onStartBarcode={handleSubmitBarcode}
                    directoryHandle={monthDirHandle ?? dirHandle}
                    subfolder={recordMode}
                  />
                </div>
              </div>

              {/* Camera Preview */}
              <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-5 shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-glow)] transition-all duration-300 h-[calc(100vh-8rem)]">
                <CameraPreview 
                  ref={cameraRef}
                  enabled={Boolean(outputFolder)} 
                  isRecording={isRecording}
                  elapsedTime={elapsedTime}
                  directoryHandle={monthDirHandle ?? dirHandle}
                  recordMode={recordMode}
                  overlayText={currentRecordingBarcode}
                />
              </div>

              {/* Recording Controls moved under Barcode Input */}

              {folderInitDone && !outputFolder && (
                <AlertDialog defaultOpen>
                  <AlertDialogContent className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Select Output Folder</AlertDialogTitle>
                      <AlertDialogDescription>
                        To start camera and recording, please choose an output folder.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="hidden" />
                      <AlertDialogAction
                        className="gap-2"
                        onClick={handleFolderSelect}
                      >
                        <FolderOpen className="w-4 h-4" />
                        Select Folder
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Right Column - Session Log */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 h-[calc(100vh-8rem)]">
                <div className="mb-4">
                  <Button 
                    variant="glass-white" 
                    className="w-full h-11 px-4 text-sm font-semibold shadow-lg"
                    onClick={toggleReversePanel}
                    disabled={isRecording && recordMode === "forward"}
                  >
                    {showReversePanel ? "Hide Reverse Mode" : "Reverse Capture Mode"}
                  </Button>
                </div>
                {showReversePanel && (
                  <div className="bg-[var(--glass-medium)] backdrop-blur-md border border-[var(--glass-border)] rounded-3xl p-4 shadow-[var(--shadow-lg)] mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Capture Reverse Photos</h3>
                      <span className="text-xs text-muted-foreground">Front, Back, Left, Right, Top, Bottom</span>
                    </div>
                    <div className="space-y-3 mb-4">
                     
                    </div>
                    <div className="mb-3">
                      <span className="px-3 py-1 rounded-xl bg-red-500/15 text-red-400 border border-red-400/30 text-xs font-semibold">
                        Reverse Packing
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {reverseOrder.map((t, idx) => {
                        const isNext = idx === reverseIndex;
                        const isDone = Boolean(reverseCaptured[t]);
                        const captureDisabled = (!isNext || isDone) || (isRecording && recordMode === "forward");
                        const retakeDisabled = (!isDone) || (isRecording && recordMode === "forward");
                        return (
                          <div key={t} className="flex gap-2 items-center">
                            <Button
                              variant="glass-white"
                              className={`h-12 w-full px-4 text-sm font-semibold shadow-lg flex-1 items-center justify-center ${isNext ? 'ring-2 ring-primary shadow-[var(--shadow-glow)]' : ''}`}
                              onClick={() => handleCapture(t)}
                              disabled={captureDisabled}
                              title={isNext ? `Capture ${t}` : isDone ? `${t} captured` : 'Wait for next step'}
                            >
                              {t}
                            </Button>
                            <Button
                              variant="glass-white"
                              className="h-10 w-10 p-0 text-sm font-semibold shadow-lg items-center justify-center"
                              onClick={() => handleCapture(t, { retake: true })}
                              disabled={retakeDisabled}
                              title={`Reload ${t}`}
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <SessionLog entries={logEntries} onDownloadLog={downloadLogFile} />
              </div>
            </div>
          </div>
        </main>
      </div>
      {showQualityAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-11/12 max-w-lg rounded-2xl bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] p-5 md:p-6 shadow-[var(--shadow-lg)]">
            <div className="text-lg font-bold md:text-xl mb-3 text-foreground text-center">Confirm Package</div>
            <p className="text-sm md:text-base text-muted-foreground mb-5 text-center">
              Is the package all right, or would you like to email the seller with the photos?
            </p>
            <div className="flex flex-col md:flex-row gap-3 md:justify-center">
              <Button
                variant="glass-white"
                className="h-11 w-full md:flex-1"
                onClick={() => handleQualityChoice("fine")}
              >
                {"It's Fine — Save & Download"}
              </Button>
              <Button
                variant="glass-white"
                className="h-11 w-full md:flex-1"
                onClick={() => handleQualityChoice("email")}
              >
                {"Email Seller & Download"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Index;
