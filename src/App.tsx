import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from '@vercel/analytics/react';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./pages/Login";
import Dashboard from "@/pages/Dashboard";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on app load - automatically logout on reload
  useEffect(() => {
    // Always start logged out on page reload/refresh
    setIsAuthenticated(false);
    localStorage.removeItem("shipsight_auth");
    // Clear any existing session lock and stored user on reload to avoid stale locks
    const userRaw = localStorage.getItem("shipsight_user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?.email) {
          localStorage.removeItem(`shipsight_lock_${user.email}`);
        }
      } catch {}
      localStorage.removeItem("shipsight_user");
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAuthenticated(true);
      localStorage.setItem("shipsight_auth", "true");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("shipsight_auth");
    // Remove session lock for current user
    const userRaw = localStorage.getItem("shipsight_user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?.email) {
          localStorage.removeItem(`shipsight_lock_${user.email}`);
        }
      } catch {}
      localStorage.removeItem("shipsight_user");
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading ShipSight...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {!isAuthenticated ? (
            <Login onLogin={handleLogin} />
          ) : (
            <Routes>
              <Route path="/dashboard" element={<Dashboard onLogout={handleLogout} />} />
              <Route path="/vms" element={<Index onLogout={handleLogout} />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
