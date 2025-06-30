import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Play, Pause, Square, RefreshCw, AlertTriangle, CheckCircle, MessageSquare } from "lucide-react";
import type { Pair, SystemStats } from "@shared/schema";

export default function SystemControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  const { data: pairs = [] } = useQuery<Pair[]>({
    queryKey: ["/api/pairs"],
    refetchInterval: 10000,
  });

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });

  const pauseAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/control/pause-all"),
    onMutate: () => setIsExecutingCommand(true),
    onSuccess: (data: any) => {
      toast({
        title: "All Pairs Paused",
        description: `Successfully paused ${data.pausedCount} active pairs`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: () => {
      toast({
        title: "Failed to Pause",
        description: "Could not pause all pairs. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => setIsExecutingCommand(false),
  });

  const resumeAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/control/resume-all"),
    onMutate: () => setIsExecutingCommand(true),
    onSuccess: (data: any) => {
      toast({
        title: "All Pairs Resumed",
        description: `Successfully resumed ${data.resumedCount} paused pairs`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: () => {
      toast({
        title: "Failed to Resume",
        description: "Could not resume all pairs. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => setIsExecutingCommand(false),
  });

  const startCopierMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/start/copier"),
    onMutate: () => setIsExecutingCommand(true),
    onSuccess: (data: any) => {
      toast({
        title: "Telegram Copier Started",
        description: "Multi-user Telegram copier is now running",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
    onError: () => {
      toast({
        title: "Failed to Start Copier",
        description: "Could not start Telegram copier. Check configuration.",
        variant: "destructive",
      });
    },
    onSettled: () => setIsExecutingCommand(false),
  });

  const activePairs = pairs.filter(p => p.status === "active");
  const pausedPairs = pairs.filter(p => p.status === "paused");
  const errorPairs = pairs.filter(p => p.status === "error");
  const isGloballyActive = activePairs.length > 0;

  const getSystemHealthStatus = () => {
    if (errorPairs.length > 0) return { status: "error", text: "System Issues", color: "text-red-600" };
    if (activePairs.length === 0) return { status: "paused", text: "All Paused", color: "text-yellow-600" };
    if (activePairs.length === pairs.length) return { status: "active", text: "All Active", color: "text-green-600" };
    return { status: "partial", text: "Partially Active", color: "text-blue-600" };
  };

  const healthStatus = getSystemHealthStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>System Control Panel</span>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              healthStatus.status === 'active' ? 'bg-green-500' :
              healthStatus.status === 'error' ? 'bg-red-500' :
              healthStatus.status === 'paused' ? 'bg-gray-500' : 'bg-yellow-500'
            }`}></div>
            <span className={`text-sm font-medium ${healthStatus.color}`}>
              {healthStatus.text}
            </span>
          </div>
        </CardTitle>
        <CardDescription>
          Control all pairs system-wide and monitor system health
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-green-600">{activePairs.length}</div>
            <div className="text-sm text-muted-foreground">Active Pairs</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{pausedPairs.length}</div>
            <div className="text-sm text-muted-foreground">Paused Pairs</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-red-600">{errorPairs.length}</div>
            <div className="text-sm text-muted-foreground">Error Pairs</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{pairs.length}</div>
            <div className="text-sm text-muted-foreground">Total Pairs</div>
          </div>
        </div>

        {/* Global Control Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isGloballyActive ? (
            <Button
              onClick={() => pauseAllMutation.mutate()}
              disabled={isExecutingCommand || pairs.length === 0}
              className="flex-1 bg-yellow-600 text-white hover:bg-yellow-700"
              size="lg"
            >
              <Pause className="w-5 h-5 mr-2" />
              {pauseAllMutation.isPending ? "Pausing All..." : `Pause All Pairs (${activePairs.length})`}
            </Button>
          ) : (
            <Button
              onClick={() => resumeAllMutation.mutate()}
              disabled={isExecutingCommand || pausedPairs.length === 0}
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              {resumeAllMutation.isPending ? "Resuming All..." : `Resume All Pairs (${pausedPairs.length})`}
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              toast({
                title: "Data Refreshed",
                description: "System data has been refreshed",
              });
            }}
            disabled={isExecutingCommand}
            size="lg"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Quick Status Messages */}
        {pairs.length === 0 && (
          <div className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-blue-600 mr-3" />
            <span className="text-sm text-blue-800">
              No pairs configured. Create your first pair to start message forwarding.
            </span>
          </div>
        )}

        {errorPairs.length > 0 && (
          <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-sm text-red-800">
              {errorPairs.length} pair(s) have errors. Check individual pair configurations.
            </span>
          </div>
        )}

        {activePairs.length > 0 && errorPairs.length === 0 && (
          <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-sm text-green-800">
              System running normally. {activePairs.length} pair(s) actively forwarding messages.
            </span>
          </div>
        )}

        {/* Telegram Copier Control */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Telegram-to-Telegram Copier</h4>
          <div className="space-y-3">
            <Button
              onClick={() => startCopierMutation.mutate()}
              disabled={isExecutingCommand}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              size="lg"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              {startCopierMutation.isPending ? "Starting Copier..." : "Start Telegram Copier"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Starts multi-user Telegram-to-Telegram message copying with trap detection
            </p>
          </div>
        </div>

        {/* Advanced Controls */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Advanced Controls</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: "Feature Coming Soon",
                  description: "Emergency stop functionality will be available in the next update",
                });
              }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Square className="w-4 h-4 mr-2" />
              Emergency Stop
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: "Feature Coming Soon",
                  description: "System restart functionality will be available in the next update",
                });
              }}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart System
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}