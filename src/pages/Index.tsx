import { useState, useRef } from "react";
import { FolderOpen } from "lucide-react";
import logoUrl from "../../logo.png";
import { Button } from "@/components/ui/button";
import { CameraPreview } from "@/components/CameraPreview";
import { BarcodeInput } from "@/components/BarcodeInput";
import { RecordingControls, LogEntry, RecordingControlsRef } from "@/components/RecordingControls";
import { SessionLog } from "@/components/SessionLog";
import { toast } from "sonner";
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

const Index = () => {
  const [barcode, setBarcode] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string>("");
  const [dirHandle, setDirHandle] = useState<any | null>(null);
  const [log, setLog] = useState<LogState>({ version: 1, updatedAt: new Date().toISOString(), barcodes: [], events: [] });
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const controlsRef = useRef<RecordingControlsRef | null>(null);

  const handleFolderSelect = async () => {
    try {
      // @ts-ignore - showDirectoryPicker is not fully supported in TS yet
      const directoryHandle = await window.showDirectoryPicker();
      setDirHandle(directoryHandle);
      setOutputFolder(directoryHandle.name);

      // Load or initialize session.log inside selected folder
      await loadTextLog(directoryHandle);
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

  const loadTextLog = async (directoryHandle: any) => {
    try {
      const fileHandle = await directoryHandle.getFileHandle("session.log", { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const usedBarcodes: string[] = [];
      const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/barcode=([^\s]+)/i);
        if (match && match[1]) {
          const code = match[1].trim();
          if (!usedBarcodes.includes(code)) usedBarcodes.push(code);
        }
      }
      setLog({ version: 1, updatedAt: new Date().toISOString(), barcodes: usedBarcodes, events: [] });
    } catch (e) {
      console.error("Failed to load session.log", e);
      toast.error("Unable to access session log file");
    }
  };

  const appendTextLog = async (line: string, directoryHandleParam?: any) => {
    try {
      const handle = directoryHandleParam ?? dirHandle;
      if (!handle) return;
      const fileHandle = await handle.getFileHandle("session.log", { create: true });
      const file = await fileHandle.getFile();
      const existing = await file.text();
      const writable = await fileHandle.createWritable();
      const next = existing && existing.length > 0 ? `${existing}\n${line}` : line;
      await writable.write(next);
      await writable.close();
    } catch (e) {
      console.error("Failed to append to session.log", e);
    }
  };

  const reserveBarcode = async (code: string): Promise<boolean> => {
    const normalized = code.trim();
    if (!normalized) {
      toast.error("Barcode is empty");
      return false;
    }
    if (log.barcodes.includes(normalized)) {
      toast.error("Barcode already used. Please enter a unique barcode.");
      return false;
    }
    const updated: LogState = { version: 1, updatedAt: new Date().toISOString(), barcodes: [...log.barcodes, normalized], events: log.events };
    setLog(updated);
    await appendTextLog(`[${new Date().toISOString()}] RESERVED barcode=${normalized}`);
    setLogEntries(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      status: "info",
      message: `Reserved barcode: ${normalized}`
    }]);
    const newEntry: LogEntry = { time: new Date().toLocaleTimeString(), status: "info", message: `Reserved barcode: ${normalized}` };
    const updatedWithEvent: LogState = { ...updated, events: [...updated.events, newEntry] };
    setLog(updatedWithEvent);
    await appendTextLog(`[${new Date().toISOString()}] EVENT status=${newEntry.status} message="${newEntry.message}"`);
    return true;
  };

  const handleSubmitBarcode = async (code: string): Promise<boolean> => {
    // If same barcode as current while recording: stop only, do not restart
    if (isRecording && controlsRef.current && code.trim() === barcode.trim() && code.trim().length > 0) {
      await controlsRef.current.stop();
      toast.error("Duplicate barcode entered; recording stopped, not restarted.");
      return false;
    }
    // If currently recording with different barcode, stop before starting new
    if (isRecording && controlsRef.current) {
      await controlsRef.current.stop();
    }
    // Attempt to start recording with this barcode
    if (!outputFolder) {
      toast.error("Please select an output folder first");
      return false;
    }
    // Reserve uniqueness via existing logic
    const ok = await reserveBarcode(code);
    if (!ok) {
      // If duplicate, do not start; if currently recording, keep it running
      return false;
    }
    // Start new recording and clear input handled by BarcodeInput
    if (controlsRef.current) {
      const started = await controlsRef.current.startWithBarcode(code);
      return started;
    }
    return false;
  };

  const downloadLogFile = async () => {
    try {
      // Read the session log file in folder if available
      if (dirHandle) {
        const fileHandle = await dirHandle.getFileHandle("session.log", { create: true });
        const file = await fileHandle.getFile();
        const text = await file.text();
        const blob = new Blob([text || ""], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session.log`;
        a.click();
      } else {
        const text = log.events.map(e => `[${new Date().toISOString()}] EVENT status=${e.status} message="${e.message}"`).join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session.log`;
        a.click();
      }
    } catch (e) {
      console.error("Download log failed", e);
      toast.error("Failed to download log file");
    }
  };

  const handleLogEntry = (entry: LogEntry) => {
    setLogEntries(prev => [...prev, entry]);
    // persist to session.log (text)
    const updated: LogState = { ...log, events: [...log.events, entry], updatedAt: new Date().toISOString() };
    setLog(updated);
    // normalize event messages for text log and barcode tracking
    const iso = new Date().toISOString();
    let line = `[${iso}] EVENT status=${entry.status} message="${entry.message}"`;
    // try to extract barcode for structured lines and tracking
    let codeMatch = entry.message.match(/Reserved barcode:\s*(\S+)/i) || entry.message.match(/Started recording for barcode:\s*(\S+)/i);
    if (!codeMatch && entry.message.startsWith("Recording saved:")) {
      const fname = entry.message.replace("Recording saved:", "").trim();
      const bc = fname.replace(/\.mp4$/i, "").trim();
      codeMatch = ["", bc] as any;
      line = `[${iso}] SAVED barcode=${bc} file=${fname}`;
    } else if (codeMatch && /Started recording/i.test(entry.message)) {
      const bc = codeMatch[1];
      line = `[${iso}] START barcode=${bc}`;
    }
    appendTextLog(line).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1e] via-[#0d1117] to-[#050810]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[var(--glass-border)] bg-[var(--glass-light)] backdrop-blur-2xl sticky top-0 z-50">
          <div className="container mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={logoUrl} alt="ShipSight Logo" className="w-10 h-10 object-contain" />
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    ShipSight
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    One platform for all your shipments
                  </p>
                </div>
              </div>
              
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
              {/* Removed header log button per request; moved beside Session Log */}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Camera & Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Camera Preview */}
              <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
                <CameraPreview enabled={Boolean(outputFolder)} />
              </div>

              {/* Barcode Input */}
              <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-lg)]">
                <BarcodeInput 
                  onBarcodeChange={setBarcode} 
                  onSubmitBarcode={handleSubmitBarcode}
                  isRecording={isRecording}
                />
              </div>

              {/* Recording Controls */}
              <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-lg)]">
                <RecordingControls 
                  ref={controlsRef}
                  barcode={barcode}
                  onRecordingStateChange={setIsRecording}
                  onLogEntry={handleLogEntry}
                  enabled={Boolean(outputFolder)}
                  onReserveBarcode={reserveBarcode}
                  directoryHandle={dirHandle}
                />
              </div>

              {!outputFolder && (
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
              <div className="sticky top-24 h-[calc(100vh-10rem)]">
                <SessionLog entries={logEntries} onDownloadLog={downloadLogFile} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
