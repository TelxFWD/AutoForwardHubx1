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
    pairType: "tel-tel", // Default to Telegram to Telegram
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
    enableTrapDetection: true,
    applyStripRules: true,
    useMentionFilter: true,
    stripFooter: false,
    footerPatterns: "",
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
      let endpoint: string;
      let pairData: any;
      
      if (data.pairType === 'tel-tel') {
        // Telegram → Telegram pairs
        endpoint = "/api/pairs/telegram";
        pairData = {
          ...data,
          // Ensure session is set and bot token is ignored
          session: data.session,
          // Footer patterns should be converted from comma-separated string to JSON
          footerPatterns: data.footerPatterns ? JSON.stringify(data.footerPatterns.split(',').map((p: string) => p.trim()).filter((p: string) => p)) : null,
        };
        // Remove bot token fields for tel-tel pairs
        delete pairData.botToken;
        delete pairData.telegramBotId;
      } else {
        // Telegram → Discord → Telegram pairs
        endpoint = data.autoWebhook ? "/api/pairs/discord-auto" : "/api/pairs/discord";
        pairData = {
          ...data,
          pairType: "tel-disc-tel",
          // Convert string IDs to numbers
          telegramBotId: data.telegramBotId ? parseInt(data.telegramBotId) : null,
          discordBotId: data.discordBotId ? parseInt(data.discordBotId) : null,
          // Footer patterns should be converted from comma-separated string to JSON
          footerPatterns: data.footerPatterns ? JSON.stringify(data.footerPatterns.split(',').map((p: string) => p.trim()).filter((p: string) => p)) : null,
        };
      }
      
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
      pairType: "tel-tel",
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
      enableTrapDetection: true,
      applyStripRules: true,
      useMentionFilter: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("=== FORM SUBMISSION DEBUG ===");
    console.log("Form data:", formData);
    console.log("Validation checks:");
    console.log("- name:", !!formData.name);
    console.log("- sourceChannel:", !!formData.sourceChannel);
    console.log("- destinationChannel:", !!formData.destinationChannel);
    console.log("- botToken:", !!formData.botToken);
    console.log("- telegramBotId:", !!formData.telegramBotId);
    console.log("- session:", !!formData.session);
    console.log("- discordBotId:", !!formData.discordBotId);
    console.log("- discordChannelId:", !!formData.discordChannelId);
    console.log("- autoWebhook:", formData.autoWebhook);
    
    // Basic validation
    if (!formData.name || !formData.sourceChannel || !formData.destinationChannel || 
        (!formData.botToken && !formData.telegramBotId) || !formData.session) {
      console.log("Basic validation failed");
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate Discord configuration only for tel-disc-tel pairs
    if (formData.pairType === 'tel-disc-tel') {
      if (formData.autoWebhook && (!formData.discordChannelId || !formData.discordBotId)) {
        toast({
          title: "Validation Error",
          description: "Discord Channel ID and Discord Bot are required when auto-webhook is enabled",
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
    }

    createPairMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof InsertPair, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg md:text-xl font-semibold text-gray-900">Create New Pair</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs md:text-sm text-gray-600 mt-2">
            Configure a new message forwarding pair
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <Label htmlFor="pairType">Forwarding Type *</Label>
              <Select value={formData.pairType} onValueChange={(value) => handleInputChange('pairType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select forwarding type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tel-tel">Telegram → Telegram</SelectItem>
                  <SelectItem value="tel-disc-tel">Telegram → Discord → Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
          
          {/* Discord Configuration - Only for tel-disc-tel */}
          {formData.pairType === 'tel-disc-tel' && (
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
          )}
          
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
          
          {/* Telegram Bot Token - Only for tel-disc-tel pairs */}
          {formData.pairType === 'tel-disc-tel' && (
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
          )}
          
          {/* User Session Note for tel-tel pairs */}
          {formData.pairType === 'tel-tel' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Uses your saved session to post messages.</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Telegram → Telegram pairs use your user session (TelethonClient) instead of bot tokens for secure message forwarding.
              </p>
            </div>
          )}
          
          {/* Advanced Features Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Advanced Features</h3>
            <p className="text-sm text-gray-600">
              Configure advanced filtering and processing options for your messages.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableTrapDetection"
                  checked={formData.enableTrapDetection}
                  onCheckedChange={(checked: CheckedState) => handleInputChange("enableTrapDetection", checked === true)}
                />
                <Label htmlFor="enableTrapDetection" className="text-sm text-gray-700">
                  Enable trap detection
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="applyStripRules"
                  checked={formData.applyStripRules}
                  onCheckedChange={(checked: CheckedState) => handleInputChange("applyStripRules", checked === true)}
                />
                <Label htmlFor="applyStripRules" className="text-sm text-gray-700">
                  Apply strip rules (headers/footers)
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useMentionFilter"
                  checked={formData.useMentionFilter}
                  onCheckedChange={(checked: CheckedState) => handleInputChange("useMentionFilter", checked === true)}
                />
                <Label htmlFor="useMentionFilter" className="text-sm text-gray-700">
                  Use mention filter
                </Label>
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
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stripFooter"
                  checked={formData.stripFooter}
                  onCheckedChange={(checked: CheckedState) => handleInputChange("stripFooter", checked === true)}
                />
                <Label htmlFor="stripFooter" className="text-sm text-gray-700">
                  Enable footer stripping
                </Label>
              </div>
            </div>
            
            {/* Footer Patterns Input - Show when footer stripping is enabled */}
            {formData.stripFooter && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="footerPatterns" className="text-sm text-gray-700">
                  Footer Regex Patterns (comma-separated)
                </Label>
                <Input
                  id="footerPatterns"
                  placeholder="join.*, shared by.*, autocopy.*"
                  value={formData.footerPatterns}
                  onChange={(e) => handleInputChange("footerPatterns", e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Example: <code>join.*</code>, <code>shared by.*</code>, <code>autocopy.*</code>
                </p>
              </div>
            )}
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 md:gap-3 pt-3 md:pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createPairMutation.isPending}
              className="w-full sm:w-auto bg-primary text-white hover:bg-blue-700"
            >
              {createPairMutation.isPending ? "Creating..." : "Create Pair"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
