import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { Circle, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RecordingControlsProps {
  barcode: string;
  onRecordingStateChange: (isRecording: boolean) => void;
  onLogEntry: (entry: LogEntry) => void;
  enabled?: boolean;
  onReserveBarcode?: (code: string) => Promise<boolean>;
  directoryHandle?: any | null;
  onStartBarcode?: (code: string) => Promise<boolean>;
}

export interface LogEntry {
  time: string;
  status: "info" | "success" | "error";
  message: string;
  imageUrl?: string; // optional thumbnail for snapshots
  tag?: string; // optional label such as Front/Back/Left/Right/Top/Bottom
}

export type RecordingControlsRef = {
  startWithBarcode: (code: string) => Promise<boolean>;
  stop: () => Promise<void>;
};

export const RecordingControls = forwardRef<RecordingControlsRef, RecordingControlsProps>(({ 
  barcode, 
  onRecordingStateChange,
  onLogEntry,
  enabled = true,
  onReserveBarcode,
  directoryHandle,
  onStartBarcode,
}: RecordingControlsProps, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<string>("webm");
  const stopResolveRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect to update elapsed time every second
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      timerIntervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - recordingStartTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (!isRecording) {
        setElapsedTime(0);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording, recordingStartTime]);

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async (codeOverride?: string, skipReserve?: boolean): Promise<boolean> => {
    if (!enabled) {
      toast.error("Please select an output folder first");
      return false;
    }
    const currentCode = (codeOverride ?? barcode).trim();
    if (!currentCode) {
      toast.error("Please enter a barcode first");
      return false;
    }
    // Reserve barcode to ensure uniqueness via log file (unless instructed to skip)
    if (!skipReserve && onReserveBarcode) {
      const ok = await onReserveBarcode(currentCode);
      if (!ok) return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }, 
        audio: false 
      });
      
      // Strict MP4-only mode: record directly to MP4, no transcoding
      const candidate = "video/mp4;codecs=h264";
      let selected: string | undefined;
      // @ts-ignore
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidate)) {
        selected = candidate;
      }
      if (!selected) {
        toast.error("Your browser cannot record MP4 directly. Please use Safari or a supported browser.");
        onLogEntry({
          time: new Date().toLocaleTimeString(),
          status: "error",
          message: "MP4 recording not supported by this browser"
        });
        return false;
      }
      const options: MediaRecorderOptions = { mimeType: selected, videoBitsPerSecond: 8_000_000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      containerRef.current = selected?.includes("mp4") ? "mp4" : "webm";
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Guard: ensure we have data
        if (!chunksRef.current || chunksRef.current.length === 0) {
          onLogEntry({
            time: new Date().toLocaleTimeString(),
            status: "error",
            message: "No recording data captured"
          });
          toast.error("No recording data captured");
          return;
        }
        // Ensure blob has a clean MP4 mime type label for broad download compatibility
        const type = "video/mp4";
        const blob = new Blob(chunksRef.current, { type });
        const ext = "mp4";
        const fileName = `${currentCode}.${ext}`;

        const downloadBlob = (b: Blob, name: string) => {
          const url = URL.createObjectURL(b);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        };

        const saveToFolder = async (): Promise<boolean> => {
          if (!directoryHandle) {
            toast.error("Select an output folder to save recordings");
            onLogEntry({
              time: new Date().toLocaleTimeString(),
              status: "error",
              message: "No output folder selected — recording not saved"
            });
            return false;
          }
          try {
            if (typeof directoryHandle.requestPermission === "function") {
              const perm = await directoryHandle.requestPermission({ mode: "readwrite" });
              if (perm !== "granted") {
                toast.error("Folder permission denied — cannot save");
                onLogEntry({
                  time: new Date().toLocaleTimeString(),
                  status: "error",
                  message: "Folder permission denied"
                });
                return false;
              }
            }
            const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            onLogEntry({
              time: new Date().toLocaleTimeString(),
              status: "success",
              message: `Recording saved: ${fileName}`
            });
            toast.success("Recording saved to selected folder");
            return true;
          } catch (e) {
            console.error("Save to folder failed", e);
            toast.error("Failed to save to selected folder");
            onLogEntry({
              time: new Date().toLocaleTimeString(),
              status: "error",
              message: "Failed to save recording to folder"
            });
            return false;
          }
        };

        const saved = await saveToFolder();
        if (!saved) {
          // Fallback: ensure user still gets the recording via browser download
          downloadBlob(blob, fileName);
          onLogEntry({
            time: new Date().toLocaleTimeString(),
            status: "info",
            message: `Recording downloaded: ${currentCode}.${ext}`
          });
          toast.message("Recording downloaded to your default folder");
        }
        
        stream.getTracks().forEach(track => track.stop());
        
        onLogEntry({
          time: new Date().toLocaleTimeString(),
          status: "success",
          message: `Recording stopped for barcode: ${currentCode}`
        });
        if (stopResolveRef.current) {
          stopResolveRef.current();
          stopResolveRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStartTime(new Date());
      onRecordingStateChange(true);
      
      toast.success("Recording started");
      onLogEntry({
        time: new Date().toLocaleTimeString(),
        status: "info",
        message: `Started recording for barcode: ${currentCode}`
      });
      return true;
    } catch (error) {
      console.error("Recording error:", error);
      toast.error("Failed to start recording");
      onLogEntry({
        time: new Date().toLocaleTimeString(),
        status: "error",
        message: "Failed to start recording"
      });
      return false;
    }
  };

  const stopRecording = async (): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        stopResolveRef.current = resolve;
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setRecordingStartTime(null);
        setElapsedTime(0);
        onRecordingStateChange(false);
        toast.success("Recording stopped");
      } else {
        resolve();
      }
    });
  };

  useImperativeHandle(ref, () => ({
    startWithBarcode: async (code: string) => {
      const ok = await startRecording(code, true);
      return ok;
    },
    stop: async () => {
      await stopRecording();
    },
  }));

  return (
    <div className="flex items-center gap-4">
      {/* Recording Controls */}
      <Button
        variant="glass-white"
        onClick={async () => { if (onStartBarcode) { await onStartBarcode(barcode); } else { await startRecording(); } }}
        disabled={!enabled}
        className="flex-1 h-11 text-sm font-semibold shadow-lg px-4"
      >
        <Circle className="w-5 h-5 mr-1 text-white" />
        Start Recording
      </Button>
      
      {/* Timer Display - Inline with buttons */}
      {isRecording && (
        <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-md border border-white/10 shadow-lg min-w-[96px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" style={{ animation: 'blink-recording 1s infinite' }}></div>
            <span className="text-white font-semibold text-base tracking-wide">
              {formatElapsedTime(elapsedTime)}
            </span>
          </div>
        </div>
      )}
      
      <Button
        variant="glass-white"
        onClick={() => { void stopRecording(); }}
        disabled={!isRecording || !enabled}
        className="flex-1 h-11 text-sm font-semibold shadow-lg px-4"
      >
        <Square className="w-5 h-5 mr-1 text-white" />
        Stop Recording
      </Button>
    </div>
  );
});
