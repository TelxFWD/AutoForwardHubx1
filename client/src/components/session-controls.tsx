import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RefreshCw, AlertTriangle, CheckCircle, Phone, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Session } from "@shared/schema";

export default function SessionControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOTPForm, setShowOTPForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingSession, setPendingSession] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    refetchInterval: 30000,
  });

  const updateSessionMutation = useMutation({
    mutationFn: (data: { sessionId: number; status: string }) =>
      apiRequest(`/api/sessions/${data.sessionId}`, { method: "PATCH", body: JSON.stringify({ status: data.status }) }),
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

  const requestOTPMutation = useMutation({
    mutationFn: (phone: string) => apiRequest("/api/sessions/request-otp", { 
      method: "POST",
      body: JSON.stringify({
        phone,
        phoneNumber: phone,  // Unified compatibility
        sessionName: `user_${phone.replace(/[+\-\s]/g, '')}`
      })
    }),
    onSuccess: (data: any) => {
      if (data.status === "otp_sent") {
        setPendingSession(data.session_name);
        toast({
          title: "OTP Sent",
          description: data.message,
        });
      } else if (data.status === "already_logged_in") {
        setShowOTPForm(false);
        setPhoneNumber("");
        // Invalidate both endpoints to sync Dashboard and TelX
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/copier/users"] });
        toast({
          title: "Already Logged In",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Failed to send OTP",
        description: "Could not send OTP. Check phone number format.",
        variant: "destructive",
      });
    },
  });

  const verifyOTPMutation = useMutation({
    mutationFn: (data: { phone: string; otp: string }) => 
      apiRequest("/api/sessions/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          code: data.otp,  // Unified compatibility
          session_name: `user_${data.phone.replace(/[+\-\s]/g, '')}`
        })
      }),
    onSuccess: (data: any) => {
      if (data.status === "success") {
        setShowOTPForm(false);
        setPhoneNumber("");
        setOtpCode("");
        setPendingSession(null);
        // Invalidate both endpoints to sync Dashboard and TelX
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/copier/users"] });
        queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
        toast({
          title: "Session Created",
          description: data.message,
        });
      } else {
        toast({
          title: "OTP Verification Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Verification Failed",
        description: "Could not verify OTP. Please try again.",
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
        <div className="space-y-6">
          {/* Add New Session Form */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Add New Session</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOTPForm(!showOTPForm)}
              >
                <Phone className="w-4 h-4 mr-2" />
                {showOTPForm ? "Cancel" : "Add Session"}
              </Button>
            </div>
            
            {showOTPForm && (
              <div className="space-y-4">
                {!pendingSession ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1234567890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => requestOTPMutation.mutate(phoneNumber)}
                      disabled={!phoneNumber || requestOTPMutation.isPending}
                      className="w-full"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {requestOTPMutation.isPending ? "Sending OTP..." : "Send OTP"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-green-600 font-medium">
                      OTP sent to {phoneNumber}
                    </div>
                    <div>
                      <Label htmlFor="otp">Enter OTP Code</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="12345"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        maxLength={6}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => verifyOTPMutation.mutate({ phone: phoneNumber, otp: otpCode })}
                        disabled={!otpCode || verifyOTPMutation.isPending}
                        className="flex-1"
                      >
                        {verifyOTPMutation.isPending ? "Verifying..." : "Verify OTP"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPendingSession(null);
                          setOtpCode("");
                        }}
                      >
                        Resend
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Existing Sessions */}
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