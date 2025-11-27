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
  subfolder?: "forward" | "reverse";
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
  subfolder,
}: RecordingControlsProps, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<string>("webm");
  const stopResolveRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const overlayRAFRef = useRef<number | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

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
      if (directoryHandle) {
        try {
          if (typeof directoryHandle.requestPermission === "function") {
            await directoryHandle.requestPermission({ mode: "readwrite" });
          }
          await directoryHandle.getDirectoryHandle("forward", { create: true });
          await directoryHandle.getDirectoryHandle("reverse", { create: true });
        } catch {}
      }
      const userStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 60 } }, 
        audio: false 
      });
      userStreamRef.current = userStream;
      
      // Prefer MP4 when available, otherwise fall back to WebM (no audio)
      const candidates = [
        "video/mp4;codecs=h264",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      let selected: string | undefined;
      // @ts-ignore
      if (window.MediaRecorder) {
        for (const c of candidates) {
          // @ts-ignore
          if (MediaRecorder.isTypeSupported(c)) { selected = c; break; }
        }
      }
      if (!selected) {
        toast.error("This browser cannot record video. Try Chrome or Safari.");
        onLogEntry({
          time: new Date().toLocaleTimeString(),
          status: "error",
          message: "No supported recording mime type"
        });
        return false;
      }
      const isMp4 = selected?.includes("mp4");
      const vbr = isMp4 ? 20_000_000 : 12_000_000;
      const options: MediaRecorderOptions = { mimeType: selected, videoBitsPerSecond: vbr };
      const videoEl = document.createElement("video");
      videoEl.srcObject = userStream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      await videoEl.play();
      const track = userStream.getVideoTracks()[0];
      try {
        const caps: any = typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
        let targetWidth = 1920;
        let targetHeight = 1080;
        let targetFps = 30;
        if (caps?.width?.max && caps?.height?.max) {
          if (caps.width.max >= 1920 && caps.height.max >= 1080) {
            targetWidth = 1920;
            targetHeight = 1080;
          } else {
            targetWidth = caps.width.max;
            targetHeight = caps.height.max;
          }
        }
        if (caps?.frameRate?.max) {
          targetFps = Math.max(30, Math.min(60, caps.frameRate.max));
        }
        await track.applyConstraints({ width: targetWidth, height: targetHeight, frameRate: targetFps });
      } catch {}
      const settings = typeof track.getSettings === "function" ? track.getSettings() : {} as any;
      const w = ((settings.width as number) ?? videoEl.videoWidth) || 1920;
      const h = ((settings.height as number) ?? videoEl.videoHeight) || 1080;
      const fps = (settings.frameRate as number) ?? 30;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // @ts-ignore
      ctx.imageSmoothingEnabled = false;
      const draw = () => {
        ctx.drawImage(videoEl, 0, 0, w, h);
        const codeText = currentCode;
        const timeText = new Date().toLocaleString();
        const padX = Math.round(w * 0.016);
        const padY = Math.round(h * 0.012);
        const fCode = Math.round(h * 0.028);
        const fTime = Math.round(h * 0.022);
        ctx.textBaseline = "top";
        ctx.font = `${fCode}px system-ui, -apple-system, Segoe UI, Roboto`;
        const codeW = ctx.measureText(codeText).width;
        ctx.font = `${fTime}px system-ui, -apple-system, Segoe UI, Roboto`;
        const timeW = ctx.measureText(timeText).width;
        const boxW = Math.max(codeW, timeW) + padX * 2;
        const boxH = fCode + fTime + padY * 3;
        const x = w - boxW - padX;
        const y = padY;
        const r = Math.round(Math.min(boxW, boxH) * 0.12);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + boxW - r, y);
        ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r);
        ctx.lineTo(x + boxW, y + boxH - r);
        ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r, y + boxH);
        ctx.lineTo(x + r, y + boxH);
        ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `${fTime}px system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillText(timeText, x + padX, y + padY);
        ctx.font = `${fCode}px system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillText(codeText, x + padX, y + padY * 2 + fTime);
        overlayRAFRef.current = requestAnimationFrame(draw);
      };
      draw();
      const stream = canvas.captureStream(Math.min(Math.max(24, fps), 60));
      canvasStreamRef.current = stream;
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
        // Use the selected container type; default WebM on Chrome/Firefox, MP4 on Safari
        const type = selected ?? "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = (selected && selected.includes("mp4")) ? "mp4" : "webm";
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

        let targetDir = directoryHandle;
        if (subfolder) {
          try {
            let sf = await directoryHandle.getDirectoryHandle(subfolder, { create: true });
            if (subfolder === "reverse") {
              sf = await sf.getDirectoryHandle(currentCode, { create: true });
            }
            targetDir = sf;
          } catch (e) {
            targetDir = directoryHandle;
          }
        }
        let finalName = fileName;
        try {
          await targetDir.getFileHandle(finalName, { create: false });
          let i = 1;
          while (true) {
            finalName = `${currentCode}_${i}.${ext}`;
            try {
              await targetDir.getFileHandle(finalName, { create: false });
              i++;
            } catch {
              break;
            }
          }
        } catch {}

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
            const fileHandle = await targetDir.getFileHandle(finalName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            onLogEntry({
              time: new Date().toLocaleTimeString(),
              status: "success",
              message: `Recording saved: ${finalName}`
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
          downloadBlob(blob, finalName);
          onLogEntry({
            time: new Date().toLocaleTimeString(),
            status: "info",
            message: `Recording downloaded: ${finalName}`
          });
          toast.message("Recording downloaded to your default folder");
        }
        
        if (canvasStreamRef.current) {
          canvasStreamRef.current.getTracks().forEach(track => track.stop());
          canvasStreamRef.current = null;
        }
        if (userStreamRef.current) {
          userStreamRef.current.getTracks().forEach(track => track.stop());
          userStreamRef.current = null;
        }
        if (overlayRAFRef.current) {
          cancelAnimationFrame(overlayRAFRef.current);
          overlayRAFRef.current = null;
        }
        
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
