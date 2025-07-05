import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, CheckCircle, Settings, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Types
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

interface BotValidationResult {
  valid: boolean;
  error?: string;
  bot?: {
    id: number;
    username: string;
    firstName: string;
    canJoinGroups: boolean;
    canReadAllGroupMessages: boolean;
  };
}

// Form schema
const botFormSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  token: z.string()
    .min(1, "Bot token is required")
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "Invalid bot token format"),
});

type BotFormData = z.infer<typeof botFormSchema>;

export function TelegramBotSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);
  const [validationResult, setValidationResult] = useState<BotValidationResult | null>(null);

  // Fetch saved bots
  const { data: bots = [], isLoading } = useQuery<TelegramBot[]>({
    queryKey: ["/api/telegram/bots"],
  });

  // Form setup
  const form = useForm<BotFormData>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: "",
      token: "",
    },
  });

  // Watch token changes for real-time validation
  const tokenValue = form.watch("token");

  useEffect(() => {
    if (tokenValue && tokenValue.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      validateTokenRealTime(tokenValue);
    } else {
      setValidationResult(null);
    }
  }, [tokenValue]);

  // Real-time token validation
  const validateTokenRealTime = async (token: string) => {
    setValidatingToken(true);
    try {
      const result = await apiRequest("/api/telegram/bots/validate", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setValidationResult(result);
    } catch (error) {
      setValidationResult({ valid: false, error: "Validation failed" });
    } finally {
      setValidatingToken(false);
    }
  };

  // Create bot mutation
  const createBotMutation = useMutation({
    mutationFn: (data: BotFormData) => 
      apiRequest("/api/telegram/bots", { 
        method: "POST", 
        body: JSON.stringify({ ...data, userId: 1 }) // TODO: Get from auth context
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bot token saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/bots"] });
      setIsAddDialogOpen(false);
      form.reset();
      setValidationResult(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save bot token",
        variant: "destructive",
      });
    },
  });

  // Delete bot mutation
  const deleteBotMutation = useMutation({
    mutationFn: (botId: number) => 
      apiRequest(`/api/telegram/bots/${botId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bot token deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/bots"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete bot token",
        variant: "destructive",
      });
    },
  });

  // Set default bot mutation
  const setDefaultMutation = useMutation({
    mutationFn: ({ botId, userId }: { botId: number; userId: number }) => 
      apiRequest(`/api/telegram/bots/${botId}/set-default`, { 
        method: "POST", 
        body: JSON.stringify({ userId }) 
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Default bot updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/bots"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default bot",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: BotFormData) => {
    if (!validationResult?.valid) {
      toast({
        title: "Invalid Token",
        description: "Please enter a valid bot token",
        variant: "destructive",
      });
      return;
    }
    createBotMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Saved Telegram Bot Tokens
        </CardTitle>
        <CardDescription>
          Manage your Telegram bot tokens for message forwarding. Tokens are stored securely and can be reused across multiple pairs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Bot Button */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {bots.length} saved bot{bots.length !== 1 ? 's' : ''}
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Bot Token
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Telegram Bot Token</DialogTitle>
                <DialogDescription>
                  Enter your bot token and a label to save it for reuse.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bot Label</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Main Bot, VIP Bot, Backup Bot" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bot Token</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" 
                            type="password"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        
                        {/* Real-time validation feedback */}
                        {validatingToken && (
                          <div className="text-sm text-muted-foreground">
                            Validating token...
                          </div>
                        )}
                        
                        {validationResult && (
                          <div className={`text-sm ${validationResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                            {validationResult.valid ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Valid bot: @{validationResult.bot?.username} ({validationResult.bot?.firstName})
                              </div>
                            ) : (
                              validationResult.error
                            )}
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddDialogOpen(false);
                        form.reset();
                        setValidationResult(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createBotMutation.isPending || !validationResult?.valid}
                    >
                      {createBotMutation.isPending ? "Saving..." : "Save Bot"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Bot List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading saved bots...
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-2">No bot tokens saved yet</div>
            <div className="text-sm text-muted-foreground">
              Add your first bot token to get started
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {bot.name}
                      {bot.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{bot.username || "Unknown"} • 
                      Status: {bot.status} • 
                      Added {new Date(bot.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!bot.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDefaultMutation.mutate({ botId: bot.id, userId: bot.userId })}
                      disabled={setDefaultMutation.isPending}
                    >
                      Set Default
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteBotMutation.mutate(bot.id)}
                    disabled={deleteBotMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}