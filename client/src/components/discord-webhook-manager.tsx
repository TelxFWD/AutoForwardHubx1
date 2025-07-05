import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Plus, Trash2, Eye, EyeOff, TestTube, Webhook } from "lucide-react";

interface DiscordBot {
  id: number;
  name: string;
  token: string;
  status: 'active' | 'inactive' | 'error';
  lastPing?: string;
  guilds?: number;
}

export default function DiscordWebhookManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});
  const [newBot, setNewBot] = useState({ name: "", token: "" });
  const [testWebhook, setTestWebhook] = useState("");

  // Mock data for demonstration - replace with actual API calls
  const discordBots: DiscordBot[] = [
    {
      id: 1,
      name: "AutoForwardX Main Bot",
      token: "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GhIjKl.MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrSt",
      status: 'active',
      lastPing: new Date().toISOString(),
      guilds: 5
    }
  ];

  const addBotMutation = useMutation({
    mutationFn: (data: { name: string; token: string }) =>
      apiRequest("/api/discord/bots", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({
        title: "Bot Added",
        description: "Discord bot has been added successfully",
      });
      setNewBot({ name: "", token: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/discord/bots"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add Discord bot",
        variant: "destructive",
      });
    },
  });

  const testBotMutation = useMutation({
    mutationFn: (botId: number) =>
      apiRequest(`/api/discord/bots/${botId}/test`, { method: "POST" }),
    onSuccess: () => {
      toast({
        title: "Bot Test Successful",
        description: "Discord bot is responding correctly",
      });
    },
    onError: () => {
      toast({
        title: "Bot Test Failed",
        description: "Bot is not responding. Check token and permissions.",
        variant: "destructive",
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (webhookUrl: string) =>
      apiRequest("/api/discord/test-webhook", { method: "POST", body: JSON.stringify({ webhookUrl }) }),
    onSuccess: () => {
      toast({
        title: "Webhook Test Successful",
        description: "Test message sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Webhook Test Failed",
        description: "Invalid webhook URL or webhook is disabled",
        variant: "destructive",
      });
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: (botId: number) =>
      apiRequest(`/api/discord/bots/${botId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({
        title: "Bot Removed",
        description: "Discord bot has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/discord/bots"] });
    },
  });

  const handleAddBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBot.name.trim() || !newBot.token.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both bot name and token",
        variant: "destructive",
      });
      return;
    }
    addBotMutation.mutate(newBot);
  };

  const toggleTokenVisibility = (botId: number) => {
    setShowTokens(prev => ({ ...prev, [botId]: !prev[botId] }));
  };

  const maskToken = (token: string, visible: boolean) => {
    if (visible) return token;
    return token.slice(0, 8) + "..." + token.slice(-8);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Bot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span>Add Discord Bot</span>
          </CardTitle>
          <CardDescription>
            Add Discord bot tokens for posting messages to channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBot} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="botName">Bot Name</Label>
                <Input
                  id="botName"
                  placeholder="e.g., Main Bot, Backup Bot"
                  value={newBot.name}
                  onChange={(e) => setNewBot(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="botToken">Bot Token</Label>
                <Input
                  id="botToken"
                  type="password"
                  placeholder="Your Discord bot token"
                  value={newBot.token}
                  onChange={(e) => setNewBot(prev => ({ ...prev, token: e.target.value }))}
                  className="mt-2"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={addBotMutation.isPending}
              className="bg-primary text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addBotMutation.isPending ? "Adding..." : "Add Bot"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Discord Bots List */}
      <Card>
        <CardHeader>
          <CardTitle>Discord Bots ({discordBots.length})</CardTitle>
          <CardDescription>
            Manage your Discord bot tokens and monitor their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discordBots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Discord bots configured. Add one above to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {discordBots.map((bot) => (
                <div key={bot.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Bot className="h-5 w-5 text-blue-500" />
                      <div>
                        <h3 className="font-medium">{bot.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {bot.guilds} guilds • Last ping: {bot.lastPing ? 
                            new Date(bot.lastPing).toLocaleString() : 'Never'
                          }
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(bot.status)}>
                      {bot.status.charAt(0).toUpperCase() + bot.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="mb-3">
                    <Label className="text-sm text-muted-foreground">Token</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        value={maskToken(bot.token, showTokens[bot.id])}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTokenVisibility(bot.id)}
                      >
                        {showTokens[bot.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testBotMutation.mutate(bot.id)}
                      disabled={testBotMutation.isPending}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBotMutation.mutate(bot.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Tester */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Webhook className="h-5 w-5" />
            <span>Webhook Tester</span>
          </CardTitle>
          <CardDescription>
            Test Discord webhook URLs to ensure they're working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Textarea
              id="webhookUrl"
              placeholder="https://discord.com/api/webhooks/..."
              value={testWebhook}
              onChange={(e) => setTestWebhook(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <Button
            onClick={() => testWebhookMutation.mutate(testWebhook)}
            disabled={testWebhookMutation.isPending || !testWebhook.trim()}
            className="bg-primary text-white hover:bg-blue-700"
          >
            <TestTube className="w-4 h-4 mr-2" />
            {testWebhookMutation.isPending ? "Testing..." : "Send Test Message"}
          </Button>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Discord Integration Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{discordBots.length}</div>
              <div className="text-sm text-muted-foreground">Active Bots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{discordBots.reduce((sum, bot) => sum + (bot.guilds || 0), 0)}</div>
              <div className="text-sm text-muted-foreground">Total Guilds</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Messages Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}