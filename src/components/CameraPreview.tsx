import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Download, Maximize2, CameraIcon, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CameraPreviewProps {
  enabled?: boolean;
  isRecording?: boolean;
  elapsedTime?: number;
}

export const CameraPreview = ({ enabled = true, isRecording = false, elapsedTime = 0 }: CameraPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const downloadSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `snapshot-${Date.now()}.png`;
          a.click();
          toast.success("Snapshot saved");
        }
      });
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="space-y-5">
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
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-black/60 backdrop-blur-sm shadow-[var(--shadow-lg)]">
        {hasCamera ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={"w-full aspect-video object-cover " + (isFlipped ? "scale-x-[-1]" : "")}
            />
            {/* Timer Overlay */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-black/40 to-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-sm tracking-wide">
                  REC {formatElapsedTime(elapsedTime)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
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
};
