import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Camera, RefreshCw, Download, Maximize2, CameraIcon, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CameraPreviewProps {
  enabled?: boolean;
  isRecording?: boolean;
  elapsedTime?: number;
  directoryHandle?: any | null;
  recordMode?: "forward" | "reverse";
  overlayText?: string;
}
export type CameraPreviewRef = {
  captureSnapshot: () => string | null;
};

export const CameraPreview = forwardRef<CameraPreviewRef, CameraPreviewProps>(({ enabled = true, isRecording = false, elapsedTime = 0, directoryHandle = null, recordMode = "forward", overlayText }: CameraPreviewProps, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const selectedDirHandle = (directoryHandle ?? (typeof window !== 'undefined' ? (window as any).__selectedDirectoryHandle : null)) ?? null;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isFlipped, setIsFlipped] = useState(false);

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (enabled) {
      initCamera(selectedDeviceId);
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
      setHasCamera(false);
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const initCamera = async (deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      toast.success("Camera connected");

      // enumerate devices after access granted
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoInputs);
      if (!deviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error("Camera error:", error);
      setHasCamera(false);
      toast.error("No camera found");
    }
  };

  const refreshCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    initCamera(selectedDeviceId);
  };

  const switchCamera = async (deviceId: string) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setSelectedDeviceId(deviceId);
    await initCamera(deviceId);
    toast.success("Switched camera");
  };

  const saveOrDownloadSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const fname = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
          const saveToFolder = async (): Promise<boolean> => {
            if (!selectedDirHandle) {
              toast.error("Select an output folder to save photos");
              return false;
            }
            try {
              if (typeof selectedDirHandle.requestPermission === "function") {
                const perm = await selectedDirHandle.requestPermission({ mode: "readwrite" });
                if (perm !== "granted") {
                  toast.error("Folder permission denied — cannot save photo");
                  return false;
                }
              }
              const fileHandle = await selectedDirHandle.getFileHandle(fname, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              toast.success("Photo saved to selected folder");
              return true;
            } catch (e) {
              console.error("Save photo failed", e);
              toast.error("Failed to save photo to selected folder");
              return false;
            }
          };

          saveToFolder().then((ok) => {
            if (!ok) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fname;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
              toast.message("Photo downloaded to your default folder");
            }
          });
        }
      });
    }
  };

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => {
      const video = videoRef.current;
      if (!video) return null;
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        return dataUrl;
      } catch {
        return null;
      }
    },
  }), []);

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-[var(--glass-medium)] border border-[var(--glass-border)]">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold">Camera Feed</span>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="glass-white"
            size="icon"
            onClick={refreshCamera}
            title="Refresh Camera"
            disabled={!enabled}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          {/* Camera selector */}
          {devices.length > 0 && (
            <select
              className="h-11 rounded-2xl bg-white/10 text-white border border-white/20 backdrop-blur-2xl px-3 text-sm shadow-lg disabled:opacity-50"
              value={selectedDeviceId}
              onChange={(e) => switchCamera(e.target.value)}
              disabled={!enabled}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="glass-white"
            size="icon"
            onClick={toggleFullscreen}
            title="Fullscreen"
            disabled={!enabled || !hasCamera}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="glass-white"
            size="icon"
            onClick={() => setIsFlipped((v) => !v)}
            title="Flip Video"
            disabled={!enabled || !hasCamera}
          >
            <FlipHorizontal className="w-4 h-4" />
          </Button>
          <Button
            variant="glass-white"
            size="icon"
            onClick={saveOrDownloadSnapshot}
            title="Capture Photo"
            disabled={!enabled || !hasCamera || !isRecording || recordMode === "forward"}
          >
            <CameraIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-black/60 backdrop-blur-sm shadow-[var(--shadow-lg)] flex-1">
        {hasCamera ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={"w-full h-full object-cover " + (isFlipped ? "scale-x-[-1]" : "")}
            />
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-black/40 to-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full" style={{ animation: 'blink-recording 1s infinite' }}></div>
                <span className="text-white font-semibold text-sm tracking-wide">
                  REC {formatElapsedTime(elapsedTime)}
                </span>
              </div>
            )}
            {isRecording && overlayText && (
              <div className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-gradient-to-r from-black/40 to-black/60 backdrop-blur-md border border-white/10 shadow-lg text-right">
                <div className="text-white text-xs font-medium leading-tight">{new Date().toLocaleString()}</div>
                <div className="text-white text-sm font-semibold tracking-wide">{overlayText}</div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
            <div className="text-center space-y-3">
              <div className="p-4 rounded-2xl bg-[var(--glass-medium)] border border-[var(--glass-border)] inline-block">
                <Camera className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No camera detected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
