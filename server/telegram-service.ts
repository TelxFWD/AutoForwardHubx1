import { TelegramBot } from "@shared/schema";

export interface TelegramBotValidationResult {
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

export class TelegramService {
  private static readonly TELEGRAM_API_BASE = "https://api.telegram.org/bot";

  static async validateBotToken(token: string): Promise<TelegramBotValidationResult> {
    try {
      const response = await fetch(`${this.TELEGRAM_API_BASE}${token}/getMe`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          error: "Invalid bot token",
        };
      }

      const data = await response.json();

      if (!data.ok) {
        return {
          valid: false,
          error: data.description || "Invalid bot token",
        };
      }

      return {
        valid: true,
        bot: {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
          canJoinGroups: data.result.can_join_groups,
          canReadAllGroupMessages: data.result.can_read_all_group_messages,
        },
      };
    } catch (error) {
      console.error("Error validating Telegram bot token:", error);
      return {
        valid: false,
        error: "Failed to validate bot token",
      };
    }
  }

  static async sendMessage(token: string, chatId: string, text: string): Promise<{
    success: boolean;
    error?: string;
    messageId?: number;
  }> {
    try {
      const response = await fetch(`${this.TELEGRAM_API_BASE}${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: "Failed to send message",
        };
      }

      const data = await response.json();

      if (!data.ok) {
        return {
          success: false,
          error: data.description || "Failed to send message",
        };
      }

      return {
        success: true,
        messageId: data.result.message_id,
      };
    } catch (error) {
      console.error("Error sending Telegram message:", error);
      return {
        success: false,
        error: "Failed to send message",
      };
    }
  }

  static async testBot(token: string): Promise<{
    success: boolean;
    error?: string;
    bot?: {
      id: number;
      username: string;
      firstName: string;
    };
  }> {
    const validation = await this.validateBotToken(token);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return {
      success: true,
      bot: validation.bot,
    };
  }

  static async getBotInfo(token: string): Promise<{
    success: boolean;
    error?: string;
    bot?: {
      id: number;
      username: string;
      firstName: string;
      canJoinGroups: boolean;
      canReadAllGroupMessages: boolean;
    };
  }> {
    const validation = await this.validateBotToken(token);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return {
      success: true,
      bot: validation.bot,
    };
  }
}