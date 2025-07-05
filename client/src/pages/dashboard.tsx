import { useState } from "react";
import StatsCards from "@/components/stats-cards";
import PairsTable from "@/components/pairs-table";
import SessionStatus from "@/components/session-status";
import SessionControls from "@/components/session-controls";
import BlocklistSummary from "@/components/blocklist-summary";
import TrapDetection from "@/components/trap-detection";
import ActivityFeed from "@/components/activity-feed";
import AddPairModal from "@/components/add-pair-modal";
import AddSessionModal from "@/components/add-session-modal";
import DiscordWebhookManager from "@/components/discord-webhook-manager";
import SystemControlPanel from "@/components/system-control-panel";
import EnvConfig from "@/components/env-config";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, UserCircle, Plus } from "lucide-react";
import type { SystemStats } from "@shared/schema";

interface DashboardProps {
  activeTab?: string;
}

export default function Dashboard({ activeTab = "dashboard" }: DashboardProps) {
  const [isAddPairModalOpen, setIsAddPairModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["/api/stats"],
  });

  const pauseAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/control/pause-all", { method: "POST" }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All pairs have been paused",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to pause all pairs",
        variant: "destructive",
      });
    },
  });

  const resumeAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/control/resume-all", { method: "POST" }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All pairs have been resumed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resume all pairs",
        variant: "destructive",
      });
    },
  });

  const isGloballyActive = Boolean(stats?.activePairs);

  const getPageTitle = () => {
    switch (activeTab) {
      case "pairs": return "Pair Management";
      case "sessions": return "Session Control";
      case "blocklist": return "Blocklist Manager";
      case "monitoring": return "Live Monitoring";
      case "webhooks": return "Discord Webhooks";
      case "settings": return "Settings";
      default: return "Dashboard Overview";
    }
  };

  const getPageDescription = () => {
    switch (activeTab) {
      case "pairs": return "Manage message forwarding pairs between Telegram and Discord";
      case "sessions": return "Control Telegram userbot sessions for reading private channels";
      case "blocklist": return "Configure trap detection and content filtering rules";
      case "monitoring": return "Monitor system activity and message flow in real-time";
      case "webhooks": return "Manage Discord webhook configurations and monitoring";
      case "settings": return "Configure system settings and preferences";
      default: return "Monitor and control your message forwarding operations";
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "pairs":
        return (
          <div className="space-y-6">
            <PairsTable onAddPair={() => setIsAddPairModalOpen(true)} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SessionStatus />
              <BlocklistSummary />
            </div>
          </div>
        );
      
      case "sessions":
        return (
          <div className="space-y-6">
            <SessionControls />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SessionStatus />
              <ActivityFeed />
            </div>
          </div>
        );
      
      case "blocklist":
        return <TrapDetection />;
      
      case "monitoring":
        return (
          <div className="space-y-6">
            <ActivityFeed />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SessionStatus />
              <BlocklistSummary />
            </div>
          </div>
        );

      case "webhooks":
        return <DiscordWebhookManager />;

      case "settings":
        return <EnvConfig />;
      
      default:
        return (
          <>
            {/* System Control Panel */}
            <div className="mb-8">
              <SystemControlPanel />
            </div>

            {/* Quick Actions & System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Quick Actions Panel */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setIsAddPairModalOpen(true)}
                    className="w-full bg-primary text-white hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Pair
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => setIsAddSessionModalOpen(true)}
                  >
                    Add Session
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={async () => {
                      try {
                        const [pairsData, sessionsData, blocklistsData] = await Promise.all([
                          fetch('/api/pairs').then(r => r.json()),
                          fetch('/api/sessions').then(r => r.json()),
                          fetch('/api/blocklists').then(r => r.json())
                        ]);
                        
                        const config = {
                          pairs: pairsData,
                          sessions: sessionsData,
                          blocklists: blocklistsData,
                          exportedAt: new Date().toISOString()
                        };
                        
                        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'autoforwardx-config.json';
                        a.click();
                        URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Export Successful",
                          description: "Configuration exported successfully",
                        });
                      } catch (error) {
                        toast({
                          title: "Export Failed",
                          description: "Failed to export configuration",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Export Config
                  </Button>
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Telegram Reader</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Discord Bot</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Admin Bot</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm font-medium text-yellow-600">Setup Required</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Dashboard Content */}
            <PairsTable onAddPair={() => setIsAddPairModalOpen(true)} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <SessionStatus />
              <BlocklistSummary />
            </div>

            <ActivityFeed />
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600">{getPageDescription()}</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Global Status */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Global Status:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isGloballyActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`text-sm font-medium ${isGloballyActive ? 'text-green-600' : 'text-gray-500'}`}>
                {isGloballyActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          {/* Global Controls */}
          {isGloballyActive ? (
            <Button 
              onClick={() => pauseAllMutation.mutate()}
              disabled={pauseAllMutation.isPending}
              className="bg-primary text-white hover:bg-blue-700"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause All
            </Button>
          ) : (
            <Button 
              onClick={() => resumeAllMutation.mutate()}
              disabled={resumeAllMutation.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Resume All
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="text-gray-700"
            onClick={() => toast({
              title: "Admin Panel",
              description: "Admin features accessible via Telegram bot",
            })}
          >
            <UserCircle className="w-4 h-4 mr-2" />
            Admin
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <StatsCards />

      {/* Main Content */}
      {renderMainContent()}

      {/* Add Pair Modal */}
      <AddPairModal 
        isOpen={isAddPairModalOpen} 
        onClose={() => setIsAddPairModalOpen(false)} 
      />

      {/* Add Session Modal */}
      <AddSessionModal 
        isOpen={isAddSessionModalOpen} 
        onClose={() => setIsAddSessionModalOpen(false)} 
      />
    </div>
  );
}
