import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X, Bot, Webhook, Settings, User } from "lucide-react";
import type { Session, InsertPair, DiscordBot } from "@shared/schema";

// Telegram Bot interface
interface TelegramBot {
  id: number;
  name: string;
  userId: number;
  token: string;
  username: string | null;
  status: string;
  isDefault: boolean;
  lastValidated: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AddPairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddPairModal({ isOpen, onClose }: AddPairModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    userId: 1, // Default user ID
    sourceChannel: "",
    discordWebhook: "",
    discordChannelId: "",
    discordBotId: "",
    autoWebhook: false,
    destinationChannel: "",
    botToken: "",
    telegramBotId: "",
    session: "",
    status: "active",
    enableAI: false,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: discordBots } = useQuery<DiscordBot[]>({
    queryKey: ["/api/discord/bots"],
  });

  const { data: telegramBots = [] } = useQuery<TelegramBot[]>({
    queryKey: ["/api/telegram/bots"],
  });

  const createPairMutation = useMutation({
    mutationFn: (data: any) => {
      // Use auto-webhook endpoint if enabled, otherwise use regular Discord endpoint
      const endpoint = data.autoWebhook ? "/api/pairs/discord-auto" : "/api/pairs/discord";
      
      // Prepare the pair data
      const pairData = {
        ...data,
        pairType: "discord",
        // Convert string IDs to numbers
        telegramBotId: data.telegramBotId ? parseInt(data.telegramBotId) : null,
        discordBotId: data.discordBotId ? parseInt(data.discordBotId) : null,
      };
      
      return apiRequest(endpoint, { method: "POST", body: JSON.stringify(pairData) });
    },
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
      userId: 1,
      sourceChannel: "",
      discordWebhook: "",
      discordChannelId: "",
      discordBotId: "",
      autoWebhook: false,
      destinationChannel: "",
      botToken: "",
      telegramBotId: "",
      session: "",
      status: "active",
      enableAI: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.sourceChannel || !formData.destinationChannel || 
        !formData.botToken || !formData.session) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate Discord configuration
    if (formData.autoWebhook && !formData.discordChannelId) {
      toast({
        title: "Validation Error",
        description: "Discord Channel ID is required when auto-webhook is enabled",
        variant: "destructive",
      });
      return;
    }

    if (!formData.autoWebhook && !formData.discordWebhook) {
      toast({
        title: "Validation Error",
        description: "Discord Webhook URL is required when auto-webhook is disabled",
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
                    <SelectItem key={session.id} value={session.name || ""}>
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
          
          {/* Auto-Webhook Toggle */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 border rounded-lg">
              <Bot className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <Label htmlFor="autoWebhook" className="text-sm font-medium">
                  Auto-Create Discord Webhook
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically create webhook using Discord bot instead of manual URL
                </p>
              </div>
              <Switch
                id="autoWebhook"
                checked={formData.autoWebhook}
                onCheckedChange={(checked) => handleInputChange("autoWebhook", checked)}
              />
            </div>

            {formData.autoWebhook ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="discordChannelId">Discord Channel ID *</Label>
                  <Input
                    id="discordChannelId"
                    placeholder="123456789012345678"
                    value={formData.discordChannelId}
                    onChange={(e) => handleInputChange("discordChannelId", e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Right-click Discord channel → Copy Channel ID
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="discordBot">Discord Bot *</Label>
                  <Select onValueChange={(value) => handleInputChange("discordBotId", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select Discord bot..." />
                    </SelectTrigger>
                    <SelectContent>
                      {discordBots?.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id.toString()}>
                          <div className="flex items-center space-x-2">
                            <Bot className="h-4 w-4" />
                            <span>{bot.name}</span>
                            <span className="text-xs text-gray-500">({bot.status})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
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
                <div className="flex items-center space-x-1 mt-1">
                  <Webhook className="h-3 w-3 text-gray-400" />
                  <p className="text-xs text-gray-500">
                    Paste your Discord webhook URL here
                  </p>
                </div>
              </div>
            )}
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
            <Label htmlFor="telegramBotId">Telegram Bot Token *</Label>
            <div className="space-y-2">
              <Select 
                value={formData.telegramBotId} 
                onValueChange={(value) => handleInputChange("telegramBotId", value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a saved bot token..." />
                </SelectTrigger>
                <SelectContent>
                  {telegramBots.length === 0 ? (
                    <SelectItem value="no-bots" disabled>
                      No saved bot tokens
                    </SelectItem>
                  ) : (
                    telegramBots.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{bot.name}</span>
                            {bot.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            @{bot.username || "unknown"}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {telegramBots.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  <Button 
                    type="button" 
                    variant="link" 
                    className="p-0 h-auto text-blue-600"
                    onClick={() => {
                      // TODO: Open settings or add bot modal
                      alert("Navigate to Settings to add bot tokens");
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Add Bot Token in Settings
                  </Button>
                </div>
              )}
            </div>
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
