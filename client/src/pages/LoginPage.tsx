import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PinInput } from "@/components/ui/pin-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LoginResponse {
  user: {
    id: number;
    pin: string;
    displayName: string;
    lastLogin: string;
  };
  token: string;
  expiresAt: string;
}

interface LoginPageProps {
  onLogin: (user: any, token: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (pin: string): Promise<LoginResponse> => {
      return apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    },
    onSuccess: (data) => {
      // Call the parent onLogin handler
      onLogin(data.user, data.token);
    },
    onError: (error: any) => {
      setError(error.message || "Login failed");
      setPin("");
    },
  });

  const handlePinComplete = (enteredPin: string) => {
    setPin(enteredPin);
    setError("");
    loginMutation.mutate(enteredPin);
  };

  const handlePinChange = () => {
    setPin("");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">AutoForwardX</CardTitle>
          <CardDescription>
            Enter your 4-digit PIN to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <PinInput
              length={4}
              onComplete={handlePinComplete}
              disabled={loginMutation.isPending}
              key={pin} // Reset component when pin changes
            />
            
            {error && (
              <Alert variant="destructive" className="w-full">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {loginMutation.isPending && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </div>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Enter your 4-digit PIN to continue</p>
            <p className="mt-2">
              Need help? Contact your administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}