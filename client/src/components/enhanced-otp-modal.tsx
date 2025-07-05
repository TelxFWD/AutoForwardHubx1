import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Clock, RefreshCw } from "lucide-react";

interface EnhancedOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: any) => void;
  phoneNumber?: string;
  sessionName?: string;
}

export function EnhancedOtpModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  phoneNumber: initialPhoneNumber = "",
  sessionName: initialSessionName = ""
}: EnhancedOtpModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [sessionName, setSessionName] = useState(initialSessionName);
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Format time remaining as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Countdown timer effect
  useEffect(() => {
    if (timeRemaining > 0 && step === "otp") {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, step]);

  // Check OTP status when phone number changes
  const { data: otpStatus, refetch: refetchOtpStatus } = useQuery({
    queryKey: ["otp-status", phoneNumber],
    queryFn: () => phoneNumber ? fetch(`/api/sessions/otp-status/${phoneNumber}`).then(res => res.json()) : null,
    enabled: !!phoneNumber && step === "otp",
    refetchInterval: 5000, // Check every 5 seconds
  });

  // Update timer based on OTP status
  useEffect(() => {
    if (otpStatus?.hasSession && otpStatus.expiresIn) {
      const remainingSeconds = Math.floor(otpStatus.expiresIn / 1000);
      setTimeRemaining(remainingSeconds);
      setIsExpired(remainingSeconds <= 0);
    }
  }, [otpStatus]);

  // Request OTP mutation
  const requestOtpMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; sessionName?: string }) =>
      apiRequest("/api/sessions/request-otp", {
        method: "POST",
        body: data,
      }),
    onSuccess: (data) => {
      if (data.success) {
        setStep("otp");
        setError("");
        const expiresInSeconds = Math.floor(data.expiresIn / 1000);
        setTimeRemaining(expiresInSeconds);
        setIsExpired(false);
        toast({
          title: "OTP Sent",
          description: data.message,
        });
      } else {
        setError(data.message || "Failed to send OTP");
      }
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "Failed to send OTP";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; code: string }) =>
      apiRequest("/api/sessions/verify-otp", {
        method: "POST",
        body: data,
      }),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Success",
          description: "OTP verified successfully",
        });
        onSuccess(data.session);
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        handleClose();
      } else {
        setError(data.message || "OTP verification failed");
      }
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "OTP verification failed";
      setError(errorMessage);
      
      // If OTP expired, allow user to request new one
      if (errorMessage.includes("expired")) {
        setIsExpired(true);
        setStep("phone");
      }
    },
  });

  // Resend OTP mutation
  const resendOtpMutation = useMutation({
    mutationFn: (data: { phoneNumber: string }) =>
      apiRequest("/api/sessions/resend-otp", {
        method: "POST",
        body: data,
      }),
    onSuccess: (data) => {
      if (data.success) {
        const expiresInSeconds = Math.floor(data.expiresIn / 1000);
        setTimeRemaining(expiresInSeconds);
        setIsExpired(false);
        setOtpCode("");
        setError("");
        toast({
          title: "OTP Resent",
          description: data.message,
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "Failed to resend OTP";
      setError(errorMessage);
    },
  });

  const handleRequestOtp = useCallback(() => {
    if (!phoneNumber.trim()) {
      setError("Phone number is required");
      return;
    }

    const finalSessionName = sessionName.trim() || `user_${phoneNumber.replace(/[+\-\s]/g, '')}`;
    setSessionName(finalSessionName);

    requestOtpMutation.mutate({
      phoneNumber: phoneNumber.trim(),
      sessionName: finalSessionName,
    });
  }, [phoneNumber, sessionName, requestOtpMutation]);

  const handleVerifyOtp = useCallback(() => {
    if (!otpCode.trim()) {
      setError("OTP code is required");
      return;
    }

    if (isExpired) {
      setError("OTP has expired. Please request a new code.");
      return;
    }

    verifyOtpMutation.mutate({
      phoneNumber: phoneNumber.trim(),
      code: otpCode.trim(),
    });
  }, [phoneNumber, otpCode, isExpired, verifyOtpMutation]);

  const handleResendOtp = useCallback(() => {
    resendOtpMutation.mutate({ phoneNumber: phoneNumber.trim() });
  }, [phoneNumber, resendOtpMutation]);

  const handleClose = () => {
    setStep("phone");
    setPhoneNumber(initialPhoneNumber);
    setSessionName(initialSessionName);
    setOtpCode("");
    setTimeRemaining(0);
    setIsExpired(false);
    setError("");
    onClose();
  };

  const isLoading = requestOtpMutation.isPending || verifyOtpMutation.isPending || resendOtpMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "phone" ? "Add Telegram Session" : "Verify OTP Code"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "phone" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionName">Session Name (Optional)</Label>
                <Input
                  id="sessionName"
                  type="text"
                  placeholder="Will be auto-generated if empty"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send OTP
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otpCode">Verification Code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  placeholder="Enter 5-6 digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading || isExpired}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              {/* Timer Display */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {isExpired ? (
                    <span className="text-destructive">Code expired</span>
                  ) : (
                    <span>Expires in: {formatTime(timeRemaining)}</span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOtp}
                  disabled={isLoading || (!isExpired && timeRemaining > 0)}
                  className="text-xs"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Resend
                </Button>
              </div>

              {isExpired && (
                <Alert>
                  <AlertDescription>
                    Your verification code has expired. Please request a new code.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || isExpired || !otpCode.trim()}
                  className="flex-1"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("phone");
                    setOtpCode("");
                    setError("");
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}