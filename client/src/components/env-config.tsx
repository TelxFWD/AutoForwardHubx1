import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ExternalLink, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnvStatus {
  TELEGRAM_API_ID: boolean;
  TELEGRAM_API_HASH: boolean;
  DISCORD_BOT_TOKEN: boolean;
  ADMIN_BOT_TOKEN: boolean;
  ADMIN_USER_IDS: boolean;
  DATABASE_URL: boolean;
  SESSION_SECRET: boolean;
  WEBHOOK_URL: boolean;
}

interface EnvResponse {
  success: boolean;
  variables: EnvStatus;
}

export default function EnvConfig() {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);

  const { data: envData, isLoading } = useQuery<EnvResponse>({
    queryKey: ["/api/config/env"],
  });

  const copyEnvTemplate = () => {
    const template = `# AutoForwardX Environment Configuration
# Add your API credentials here

# Required Telegram API Credentials
TELEGRAM_API_ID=your_telegram_api_id_here
TELEGRAM_API_HASH=your_telegram_api_hash_here

# Optional Bot Tokens
DISCORD_BOT_TOKEN=your_discord_bot_token_here
ADMIN_BOT_TOKEN=your_telegram_admin_bot_token_here

# Admin Configuration
ADMIN_USER_IDS=your_telegram_user_id_here

# Database Configuration (Optional - uses in-memory storage if not set)
DATABASE_URL=postgresql://username:password@host:port/database

# Server Configuration
PORT=5000
NODE_ENV=development

# Session Security
SESSION_SECRET=your_session_secret_here

# Optional: Webhook URLs
WEBHOOK_URL=your_webhook_url_here`;

    navigator.clipboard.writeText(template);
    toast({
      title: "Template Copied",
      description: "Environment template copied to clipboard"
    });
  };

  const getStatusIcon = (isSet: boolean) => {
    if (isSet) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (isSet: boolean, isRequired: boolean = false) => {
    if (isSet) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Set</Badge>;
    }
    if (isRequired) {
      return <Badge variant="destructive">Required</Badge>;
    }
    return <Badge variant="secondary">Optional</Badge>;
  };

  const requiredVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH'];
  const optionalVars = ['DISCORD_BOT_TOKEN', 'ADMIN_BOT_TOKEN', 'ADMIN_USER_IDS', 'DATABASE_URL', 'SESSION_SECRET', 'WEBHOOK_URL'];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>Loading environment status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const envStatus = envData?.variables;
  const requiredMissing = requiredVars.filter(key => !envStatus?.[key as keyof EnvStatus]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Environment Configuration
            {requiredMissing.length > 0 && (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
          </CardTitle>
          <CardDescription>
            Manage your API credentials and environment variables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredMissing.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Missing required environment variables: {requiredMissing.join(', ')}. 
                Please update your .env file.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={() => setShowInstructions(!showInstructions)} variant="outline">
              {showInstructions ? 'Hide' : 'Show'} Setup Instructions
            </Button>
            <Button onClick={copyEnvTemplate} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy .env Template
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://my.telegram.org/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Get API Credentials
              </a>
            </Button>
          </div>

          {showInstructions && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-3">
              <h4 className="font-semibold">Setup Instructions:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Visit <a href="https://my.telegram.org/apps" target="_blank" className="text-blue-600 underline">my.telegram.org/apps</a> to get your API credentials</li>
                <li>Create or update the .env file in your project root</li>
                <li>Replace the placeholder values with your actual credentials</li>
                <li>Restart the application to load the new variables</li>
              </ol>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3">Required Variables</h4>
              <div className="grid gap-3">
                {requiredVars.map((key) => (
                  <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(envStatus?.[key as keyof EnvStatus] || false)}
                      <span className="font-mono text-sm">{key}</span>
                    </div>
                    {getStatusBadge(envStatus?.[key as keyof EnvStatus] || false, true)}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Optional Variables</h4>
              <div className="grid gap-3">
                {optionalVars.map((key) => (
                  <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(envStatus?.[key as keyof EnvStatus] || false)}
                      <span className="font-mono text-sm">{key}</span>
                    </div>
                    {getStatusBadge(envStatus?.[key as keyof EnvStatus] || false, false)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}