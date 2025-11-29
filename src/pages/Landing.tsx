import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logoUrl from "../../logo.png";

const Landing = () => {
  const navigate = useNavigate();
  const handleGoToVms = () => {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocal = host === "localhost" || host === "127.0.0.1" || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isLocal) {
      navigate("/vms");
    } else {
      window.location.href = "https://vms.shipsight.in/";
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--shadow-lg)] flex items-center justify-center">
          <img src={logoUrl} alt="ShipSight" className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">ShipSight</h1>
        <p className="text-muted-foreground mb-6">Go to VMS to sign in and manage recordings</p>
        <Button variant="glass-white" className="w-full h-11" onClick={handleGoToVms}>Go to VMS</Button>
      </div>
    </div>
  );
};

export default Landing;