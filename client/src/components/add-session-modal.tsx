import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X, Phone, Shield, CheckCircle } from "lucide-react";
import type { InsertSession } from "@shared/schema";

interface AddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddSessionModal({ isOpen, onClose }: AddSessionModalProps) {
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [otpCode, setOtpCode] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [formData, setFormData] = useState<InsertSession>({
    name: "",
    phone: "",
    sessionFile: "",
    status: "inactive",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createSessionMutation = useMutation({
    mutationFn: (data: InsertSession) => apiRequest("POST", "/api/sessions", data),
    onSuccess: (response: any) => {
      setSessionId(response.id);
      setStep('otp');
      toast({
        title: "Session Created",
        description: "Please check your phone for Telegram OTP code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create session",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (data: { sessionId: number; otpCode: string }) => 
      apiRequest("POST", `/api/sessions/${data.sessionId}/verify-otp`, { otpCode: data.otpCode }),
    onSuccess: () => {
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Session verified and activated successfully!",
      });
      setTimeout(() => {
        onClose();
        resetForm();
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep('form');
    setOtpCode("");
    setSessionId(null);
    setFormData({
      name: "",
      phone: "",
      sessionFile: "",
      status: "inactive",
    });
  };

  const handleVerifyOtp = () => {
    if (!otpCode.trim() || !sessionId) {
      toast({
        title: "Invalid Input",
        description: "Please enter the OTP code",
        variant: "destructive",
      });
      return;
    }
    verifyOtpMutation.mutate({ sessionId, otpCode: otpCode.trim() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.phone) {
      toast({
        title: "Validation Error",
        description: "Please fill in session name and phone number",
        variant: "destructive",
      });
      return;
    }

    // Auto-generate session file name if not provided
    const sessionFile = formData.sessionFile || `${formData.name.toLowerCase().replace(/\s+/g, '_')}.session`;
    
    createSessionMutation.mutate({
      ...formData,
      sessionFile,
    });
  };

  const handleInputChange = (field: keyof InsertSession, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderContent = () => {
    switch (step) {
      case 'form':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="sessionName">Session Name *</Label>
              <Input
                id="sessionName"
                placeholder="e.g., Main Account, Secondary Bot"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <div className="relative mt-2">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Include country code (e.g., +1 for US, +44 for UK)
              </p>
            </div>
            
            <div>
              <Label htmlFor="sessionFile">Session File (Optional)</Label>
              <Input
                id="sessionFile"
                placeholder="Auto-generated from session name"
                value={formData.sessionFile}
                onChange={(e) => handleInputChange("sessionFile", e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate filename
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createSessionMutation.isPending}
                className="bg-primary text-white hover:bg-blue-700"
              >
                {createSessionMutation.isPending ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </form>
        );

      case 'otp':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">OTP Verification Required</h3>
              <p className="text-sm text-gray-600 mt-2">
                Telegram has sent a verification code to {formData.phone}
              </p>
            </div>
            
            <div>
              <Label htmlFor="otpCode">Verification Code</Label>
              <Input
                id="otpCode"
                placeholder="Enter 5-6 digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="mt-2 text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button 
                onClick={handleVerifyOtp}
                disabled={verifyOtpMutation.isPending || !otpCode.trim()}
                className="bg-primary text-white hover:bg-blue-700"
              >
                {verifyOtpMutation.isPending ? "Verifying..." : "Verify OTP"}
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">Session Activated!</h3>
              <p className="text-sm text-gray-600 mt-2">
                Your Telegram session has been successfully verified and activated.
              </p>
            </div>
            <Badge variant="outline" className="text-green-600">
              Ready for use
            </Badge>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              {step === 'form' ? 'Add New Session' : 
               step === 'otp' ? 'Verify Phone Number' : 
               'Session Created'}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {step === 'form' && (
            <p className="text-sm text-gray-600 mt-2">
              Add a new Telegram userbot session for reading private channels
            </p>
          )}
        </DialogHeader>
        
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}