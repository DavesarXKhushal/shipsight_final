import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Circle, Square } from "lucide-react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<string>("webm");
  const stopResolveRef = useRef<(() => void) | null>(null);

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
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, 
        audio: false 
      });
      
      // Choose preferred mime type: try mp4, then h264 webm, then vp9, then vp8
      const candidates = [
        "video/mp4",
        "video/webm;codecs=h264",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      let selected: string | undefined;
      for (const c of candidates) {
        // @ts-ignore
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) {
          selected = c; break;
        }
      }
      const options: MediaRecorderOptions = selected ? { mimeType: selected, videoBitsPerSecond: 3_000_000 } : { videoBitsPerSecond: 3_000_000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      containerRef.current = selected?.includes("mp4") ? "mp4" : "webm";
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = selected ?? "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        const fileName = `${currentCode}.mp4`;

        const saveToFolder = async () => {
          if (!directoryHandle) return false;
          try {
            const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
          } catch (e) {
            console.error("Save to folder failed", e);
            return false;
          }
        };

        saveToFolder().then((saved) => {
          if (!saved) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
          }
          onLogEntry({
            time: new Date().toLocaleTimeString(),
            status: "success",
            message: `Recording saved: ${currentCode}.mp4`
          });
        });
        
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

  const stopRecording = (): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        stopResolveRef.current = resolve;
        mediaRecorderRef.current.stop();
        setIsRecording(false);
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
    <div className="flex gap-4">
      <Button
        variant="glass-white"
        onClick={async () => { if (onStartBarcode) { await onStartBarcode(barcode); } else { await startRecording(); } }}
        disabled={!enabled}
        className="flex-1 h-14 text-base font-semibold shadow-lg"
      >
        <Circle className="w-5 h-5 mr-1 text-white" />
        Start Recording
      </Button>
      <Button
        variant="glass-white"
        onClick={() => { void stopRecording(); }}
        disabled={!isRecording || !enabled}
        className="flex-1 h-14 text-base font-semibold shadow-lg"
      >
        <Square className="w-5 h-5 mr-1 text-white" />
        Stop Recording
      </Button>
    </div>
  );
});
