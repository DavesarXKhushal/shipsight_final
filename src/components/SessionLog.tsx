import { useEffect, useRef } from "react";
import { FileText, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { LogEntry } from "./RecordingControls";

interface SessionLogProps {
  entries: LogEntry[];
  onDownloadLog?: () => void;
}

export const SessionLog = ({ entries, onDownloadLog }: SessionLogProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const getStatusIcon = (status: LogEntry["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  // Auto-scroll to the latest entry when entries update
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [entries]);

  // Ensure auto-scroll on initial mount and when the log container resizes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Initial scroll
    el.scrollTo({ top: el.scrollHeight });
    // Scroll on resize (e.g., layout changes when panels open/close)
    const ro = new ResizeObserver(() => {
      el.scrollTo({ top: el.scrollHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-6 shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Session Log</h2>
        </div>
        {onDownloadLog && (
          <button
            className="h-10 px-3 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 text-white text-sm shadow-lg hover:bg-white/15"
            onClick={onDownloadLog}
          >
            Download Log File
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 rounded-2xl bg-[var(--glass-medium)] border border-[var(--glass-border)] inline-block mb-4">
              <FileText className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              No activity logged yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start recording to see session logs
            </p>
          </div>
        ) : (
          entries.map((entry, index) => (
            <div
              key={index}
              className="flex gap-3 p-4 rounded-2xl bg-[var(--glass-light)] border border-[var(--glass-border)] hover:bg-[var(--glass-medium)] transition-all duration-200 hover:shadow-md"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(entry.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-muted-foreground font-mono">
                    {entry.time}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.status === "success" 
                      ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" 
                      : entry.status === "error"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-primary/15 text-primary"
                  }`}>
                    {entry.status}
                  </span>
                </div>
                <p className="text-sm text-foreground/85 break-words leading-relaxed">
                  {entry.message}
                  {entry.tag ? ` — ${entry.tag}` : ""}
                </p>
                {entry.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={entry.imageUrl}
                      alt={entry.tag || "Snapshot"}
                      className="h-20 w-auto rounded-xl border border-[var(--glass-border)] shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-[var(--glass-border)]">
        <p className="text-xs text-muted-foreground text-center">
          Files saved as <span className="font-mono text-primary bg-primary/10 px-2 py-1 rounded">BARCODE.mp4</span>
        </p>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--glass-border);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--glass-hover);
        }
      `}</style>
    </div>
  );
};
