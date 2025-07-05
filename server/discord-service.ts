import { IStorage } from "./storage";
import type { DiscordBot, InsertDiscordBot } from "@shared/schema";

export interface DiscordWebhookResult {
  success: boolean;
  webhookUrl?: string;
  error?: string;
}

export class DiscordService {
  constructor(private storage: IStorage) {}

  async createWebhook(channelId: string, webhookName: string, botToken: string): Promise<DiscordWebhookResult> {
    try {
      // Discord API endpoint for creating webhooks
      const url = `https://discord.com/api/v10/channels/${channelId}/webhooks`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: webhookName || 'AutoForwardX',
          avatar: null, // Optional: Could add AutoForwardX logo
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Discord webhook creation failed:', error);
        return {
          success: false,
          error: `Discord API error: ${response.status} - ${error}`,
        };
      }

      const webhook = await response.json();
      return {
        success: true,
        webhookUrl: webhook.url,
      };
    } catch (error) {
      console.error('Error creating Discord webhook:', error);
      return {
        success: false,
        error: `Failed to create webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async validateBotToken(token: string): Promise<{ valid: boolean; botInfo?: any; error?: string }> {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          'Authorization': `Bot ${token}`,
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `Invalid bot token: ${response.status}`,
        };
      }

      const botInfo = await response.json();
      return {
        valid: true,
        botInfo,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getBotGuilds(token: string): Promise<{ success: boolean; guilds?: any[]; error?: string }> {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
          'Authorization': `Bot ${token}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch guilds: ${response.status}`,
        };
      }

      const guilds = await response.json();
      return {
        success: true,
        guilds,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch guilds: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getChannelInfo(channelId: string, botToken: string): Promise<{ success: boolean; channel?: any; error?: string }> {
    try {
      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        headers: {
          'Authorization': `Bot ${botToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch channel info: ${response.status}`,
        };
      }

      const channel = await response.json();
      return {
        success: true,
        channel,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch channel info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async testWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '✅ AutoForwardX webhook test successful!',
          embeds: [{
            title: 'Webhook Test',
            description: 'This webhook is working correctly.',
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
          }],
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Webhook test failed: ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async deleteWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'DELETE',
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to delete webhook: ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}