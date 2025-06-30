import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import TelXPage from "@/pages/telx";

function App() {
  const [activeView, setActiveView] = useState("dashboard");

  const renderContent = () => {
    switch (activeView) {
      case "telx":
        return <TelXPage />;
      case "dashboard":
      case "pairs":
      case "sessions":
      case "blocklist":
      case "monitoring":
      case "webhooks":
      case "settings":
        return <Dashboard activeTab={activeView} />;
      default:
        return <Dashboard activeTab="dashboard" />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen bg-gray-50">
          <Sidebar activeView={activeView} onViewChange={setActiveView} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderContent()}
            </div>
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
