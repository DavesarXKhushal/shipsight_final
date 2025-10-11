import { useState } from "react";
import { Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BarcodeInputProps {
  onBarcodeChange: (barcode: string) => void;
  onSubmitBarcode: (barcode: string) => Promise<boolean>;
  isRecording: boolean;
}

export const BarcodeInput = ({ onBarcodeChange, onSubmitBarcode, isRecording }: BarcodeInputProps) => {
  const [barcode, setBarcode] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcode(value);
    onBarcodeChange(value);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcode.trim();
      if (!code) return;
      const ok = await onSubmitBarcode(code);
      if (ok) {
        setBarcode("");
        onBarcodeChange("");
      }
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-semibold flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
          <Scan className="w-4 h-4 text-primary" />
        </div>
        Barcode Scanner
      </label>
      <div className="relative">
        <Input
          type="text"
          placeholder="Scan or type barcode..."
          value={barcode}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          // keep editable during recording per request
          className="bg-[var(--glass-light)] backdrop-blur-2xl border-[var(--glass-border)] text-foreground placeholder:text-muted-foreground/50 focus:bg-[var(--glass-medium)] focus:border-primary/50 transition-all duration-300 h-14 text-base px-5 rounded-2xl shadow-inner"
        />
        {isRecording && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-xs text-red-400 font-medium">REC</span>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-glow shadow-lg shadow-red-500/50" />
          </div>
        )}
      </div>
    </div>
  );
};
