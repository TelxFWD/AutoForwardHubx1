import { TelegramBotSettings } from "@/components/telegram-bot-settings";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your bot tokens, configuration, and preferences.
        </p>
      </div>

      <TelegramBotSettings />
    </div>
  );
}