import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Session } from "@shared/schema";

export default function SessionControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["/api/sessions"],
    refetchInterval: 30000,
  });

  const updateSessionMutation = useMutation({
    mutationFn: (data: { sessionId: number; status: string }) =>
      apiRequest("PATCH", `/api/sessions/${data.sessionId}`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Session updated",
        description: "Session status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update session status.",
        variant: "destructive",
      });
    },
  });

  const handleSessionAction = (sessionId: number, action: string) => {
    const newStatus = action === "start" ? "active" : "inactive";
    updateSessionMutation.mutate({ sessionId, status: newStatus });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "inactive":
        return "bg-gray-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />;
      case "error":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Controls</CardTitle>
          <CardDescription>Loading session data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram Sessions</CardTitle>
        <CardDescription>
          Manage userbot sessions for reading private channels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sessions configured. Add sessions through the session loader.
            </div>
          ) : (
            sessions.map((session: Session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(session.status)}`} />
                  <div>
                    <div className="font-medium">{session.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {session.phone} • {session.sessionFile}
                    </div>
                    {session.lastActive && (
                      <div className="text-xs text-muted-foreground">
                        Last active: {new Date(session.lastActive).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="flex items-center space-x-1">
                    {getStatusIcon(session.status)}
                    <span className="capitalize">{session.status}</span>
                  </Badge>
                  
                  <div className="flex space-x-1">
                    {session.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSessionAction(session.id, "stop")}
                        disabled={updateSessionMutation.isPending}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSessionAction(session.id, "start")}
                        disabled={updateSessionMutation.isPending}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sessions"] })}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {sessions.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {sessions.filter((s: Session) => s.status === "active").length} of {sessions.length} sessions active
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}