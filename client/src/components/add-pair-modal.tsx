import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";
import type { Session, InsertPair } from "@shared/schema";

interface AddPairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddPairModal({ isOpen, onClose }: AddPairModalProps) {
  const [formData, setFormData] = useState<InsertPair>({
    name: "",
    sourceChannel: "",
    discordWebhook: "",
    destinationChannel: "",
    botToken: "",
    session: "",
    status: "active",
    enableAI: false,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const createPairMutation = useMutation({
    mutationFn: (data: InsertPair) => apiRequest("POST", "/api/pairs", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pair created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create pair",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      sourceChannel: "",
      discordWebhook: "",
      destinationChannel: "",
      botToken: "",
      session: "",
      status: "active",
      enableAI: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.sourceChannel || !formData.discordWebhook || 
        !formData.destinationChannel || !formData.botToken || !formData.session) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createPairMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof InsertPair, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900">Create New Pair</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Configure a new message forwarding pair between Telegram and Discord channels
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="pairName">Pair Name *</Label>
              <Input
                id="pairName"
                placeholder="e.g., EURUSD"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="session">Session *</Label>
              <Select value={formData.session} onValueChange={(value) => handleInputChange("session", value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select session..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions?.map((session) => (
                    <SelectItem key={session.id} value={session.name}>
                      {session.name} ({session.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="sourceChannel">Source Telegram Channel *</Label>
            <Input
              id="sourceChannel"
              placeholder="@source_channel or channel ID"
              value={formData.sourceChannel}
              onChange={(e) => handleInputChange("sourceChannel", e.target.value)}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label htmlFor="discordWebhook">Discord Webhook URL *</Label>
            <Input
              id="discordWebhook"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={formData.discordWebhook}
              onChange={(e) => handleInputChange("discordWebhook", e.target.value)}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label htmlFor="destinationChannel">Destination Telegram Channel *</Label>
            <Input
              id="destinationChannel"
              placeholder="@destination_channel or channel ID"
              value={formData.destinationChannel}
              onChange={(e) => handleInputChange("destinationChannel", e.target.value)}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label htmlFor="botToken">Telegram Bot Token *</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="Bot token for posting to destination"
              value={formData.botToken}
              onChange={(e) => handleInputChange("botToken", e.target.value)}
              className="mt-2"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enableAI"
              checked={formData.enableAI}
              onCheckedChange={(checked: CheckedState) => handleInputChange("enableAI", checked === true)}
            />
            <Label htmlFor="enableAI" className="text-sm text-gray-700">
              Enable AI content filtering
            </Label>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createPairMutation.isPending}
              className="bg-primary text-white hover:bg-blue-700"
            >
              {createPairMutation.isPending ? "Creating..." : "Create Pair"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
