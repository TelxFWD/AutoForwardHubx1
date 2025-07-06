import { storage } from "./storage";
import type { Pair } from "@shared/schema";

/**
 * Centralized Message Forwarding Service
 * Handles both tel-tel and tel-disc-tel forwarding modes with shared session management
 */

export interface ForwardMessageParams {
  type: 'tel-tel' | 'tel-disc-tel';
  message: any;
  sourceChannel: string;
  destinationChannel: string;
  userSession: string;
  pairConfig: Pair;
  features: {
    trapDetection: boolean;
    stripRules: boolean;
    mentionFilter: boolean;
    aiFiltering: boolean;
  };
}

export interface MessageProcessingResult {
  success: boolean;
  messageId?: string;
  processedContent?: string;
  blocked?: boolean;
  blockReason?: string;
  error?: string;
}

export class MessageForwardingService {
  private static instance: MessageForwardingService;
  private activeSessions: Map<string, any> = new Map(); // Shared Telegram sessions

  static getInstance(): MessageForwardingService {
    if (!MessageForwardingService.instance) {
      MessageForwardingService.instance = new MessageForwardingService();
    }
    return MessageForwardingService.instance;
  }

  /**
   * Main message forwarding entry point
   */
  async forwardMessage(params: ForwardMessageParams): Promise<MessageProcessingResult> {
    try {
      // Apply advanced processing features
      const processedMessage = await this.processMessage(params);
      
      if (processedMessage.blocked) {
        return processedMessage;
      }

      // Route based on pair type
      if (params.type === 'tel-tel') {
        return await this.forwardTelToTel(params, processedMessage.processedContent);
      } else if (params.type === 'tel-disc-tel') {
        return await this.forwardTelDiscTel(params, processedMessage.processedContent);
      } else {
        return { success: false, error: 'Invalid forwarding type' };
      }
    } catch (error) {
      console.error('Message forwarding failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Apply advanced processing features to message content
   */
  private async processMessage(params: ForwardMessageParams): Promise<MessageProcessingResult> {
    let content = this.extractMessageContent(params.message);
    
    // Apply trap detection
    if (params.features.trapDetection) {
      const trapResult = await this.detectTraps(content, params.pairConfig);
      if (trapResult.blocked) {
        await this.logActivity('trap_detected', params.pairConfig.id, trapResult.blockReason);
        return trapResult;
      }
    }

    // Apply strip rules (headers/footers)
    if (params.features.stripRules) {
      content = await this.applyStripRules(content, params.pairConfig);
    }

    // Apply mention filtering
    if (params.features.mentionFilter) {
      content = await this.filterMentions(content);
    }

    // Apply AI filtering
    if (params.features.aiFiltering) {
      const aiResult = await this.applyAIFiltering(content, params.pairConfig);
      if (aiResult.blocked) {
        await this.logActivity('ai_filter_blocked', params.pairConfig.id, aiResult.blockReason);
        return aiResult;
      }
      content = aiResult.processedContent || content;
    }

    return { success: true, processedContent: content };
  }

  /**
   * Handle Telegram → Telegram forwarding
   */
  private async forwardTelToTel(
    params: ForwardMessageParams, 
    processedContent?: string
  ): Promise<MessageProcessingResult> {
    try {
      // Get or create shared session
      const session = await this.getSharedSession(params.userSession);
      
      // Send message directly to destination channel using userbot session
      const messageId = await this.sendTelegramMessage(
        session,
        params.destinationChannel,
        processedContent || this.extractMessageContent(params.message)
      );

      // Update pair statistics
      await this.updatePairStats(params.pairConfig.id, 'message_sent');
      
      // Log activity
      await this.logActivity('tel_tel_forwarded', params.pairConfig.id, 
        `Message forwarded from ${params.sourceChannel} to ${params.destinationChannel}`);

      return { success: true, messageId };
    } catch (error) {
      console.error('Tel-Tel forwarding failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Handle Telegram → Discord → Telegram forwarding
   */
  private async forwardTelDiscTel(
    params: ForwardMessageParams, 
    processedContent?: string
  ): Promise<MessageProcessingResult> {
    try {
      const content = processedContent || this.extractMessageContent(params.message);
      
      // Step 1: Send to Discord webhook
      const discordMessageId = await this.sendToDiscordWebhook(
        params.pairConfig.discordWebhook || '',
        content
      );

      // Step 2: Discord bot processes and sends to Telegram destination
      // This will be handled by the Discord bot listening to the webhook channel
      
      // Update pair statistics
      await this.updatePairStats(params.pairConfig.id, 'message_sent');
      
      // Log activity
      await this.logActivity('tel_disc_tel_forwarded', params.pairConfig.id, 
        `Message forwarded from ${params.sourceChannel} via Discord to ${params.destinationChannel}`);

      return { success: true, messageId: discordMessageId };
    } catch (error) {
      console.error('Tel-Disc-Tel forwarding failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get or create a shared Telegram session
   */
  private async getSharedSession(sessionName: string): Promise<any> {
    if (this.activeSessions.has(sessionName)) {
      return this.activeSessions.get(sessionName);
    }

    // Create new session connection
    const session = await this.createTelegramSession(sessionName);
    this.activeSessions.set(sessionName, session);
    return session;
  }

  /**
   * Detect trap patterns in message content
   */
  private async detectTraps(content: string, pairConfig: Pair): Promise<MessageProcessingResult> {
    // Common trap patterns
    const trapPatterns = [
      /^\s*\/\s*\*+\s*$/,  // "/ *" pattern
      /^\s*1\s*$/,         // Single "1"
      /leak/i,             // "leak" keyword
      /trap/i,             // "trap" keyword
      /test\s*message/i,   // Test messages
    ];

    for (const pattern of trapPatterns) {
      if (pattern.test(content)) {
        return {
          success: false,
          blocked: true,
          blockReason: `Trap pattern detected: ${pattern.source}`
        };
      }
    }

    // Check against custom blocklist
    const blocklists = await storage.getBlocklists(pairConfig.id);
    for (const item of blocklists) {
      if (item.type === 'text' && content.toLowerCase().includes(item.value.toLowerCase())) {
        return {
          success: false,
          blocked: true,
          blockReason: `Blocked by custom filter: ${item.value}`
        };
      }
    }

    return { success: true };
  }

  /**
   * Apply header/footer strip rules
   */
  private async applyStripRules(content: string, pairConfig: Pair): Promise<string> {
    let processed = content;

    // Apply header patterns
    if (pairConfig.headerPatterns) {
      try {
        const patterns = JSON.parse(pairConfig.headerPatterns);
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'gi');
          processed = processed.replace(regex, '');
        }
      } catch (e) {
        console.warn('Invalid header patterns JSON:', pairConfig.headerPatterns);
      }
    }

    // Apply footer patterns
    if (pairConfig.footerPatterns) {
      try {
        const patterns = JSON.parse(pairConfig.footerPatterns);
        for (const pattern of patterns) {
          const regex = new RegExp(pattern, 'gi');
          processed = processed.replace(regex, '');
        }
      } catch (e) {
        console.warn('Invalid footer patterns JSON:', pairConfig.footerPatterns);
      }
    }

    return processed.trim();
  }

  /**
   * Filter mentions (@username, @everyone, @here)
   */
  private async filterMentions(content: string): Promise<string> {
    return content
      .replace(/@everyone/g, 'everyone')
      .replace(/@here/g, 'here')
      .replace(/@(\w+)/g, '$1'); // Remove @ symbol from usernames
  }

  /**
   * Apply AI-based content filtering
   */
  private async applyAIFiltering(content: string, pairConfig: Pair): Promise<MessageProcessingResult> {
    // TODO: Implement AI filtering logic
    // This could integrate with OpenAI, local models, or other AI services
    
    // For now, return content as-is
    return { success: true, processedContent: content };
  }

  /**
   * Extract text content from various message types
   */
  private extractMessageContent(message: any): string {
    if (typeof message === 'string') {
      return message;
    }
    
    return message.text || message.content || message.message || '';
  }

  /**
   * Send message to Telegram using userbot session
   */
  private async sendTelegramMessage(session: any, channel: string, content: string): Promise<string> {
    // TODO: Implement actual Telegram API call using Telethon/Pyrogram
    // This would use the shared session to send messages
    
    // Placeholder implementation
    console.log(`Sending to Telegram ${channel}:`, content);
    return `tel_${Date.now()}`;
  }

  /**
   * Send message to Discord webhook
   */
  private async sendToDiscordWebhook(webhookUrl: string, content: string): Promise<string> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }

    return `disc_${Date.now()}`;
  }

  /**
   * Create Telegram session connection
   */
  private async createTelegramSession(sessionName: string): Promise<any> {
    // TODO: Implement actual session creation using Telethon
    // This would load the .session file and create a client connection
    
    // Placeholder implementation
    console.log(`Creating Telegram session: ${sessionName}`);
    return { sessionName, connected: true };
  }

  /**
   * Update pair statistics
   */
  private async updatePairStats(pairId: number, action: 'message_sent' | 'message_blocked'): Promise<void> {
    try {
      const pair = await storage.getPair(pairId);
      if (pair) {
        if (action === 'message_sent') {
          await storage.updatePair(pairId, { 
            messageCount: (pair.messageCount || 0) + 1,
            updatedAt: new Date().toISOString()
          });
        } else if (action === 'message_blocked') {
          await storage.updatePair(pairId, { 
            blockedCount: (pair.blockedCount || 0) + 1,
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Failed to update pair stats:', error);
    }
  }

  /**
   * Log forwarding activity
   */
  private async logActivity(type: string, pairId: number, details: string): Promise<void> {
    try {
      await storage.createActivity({
        type,
        message: `Message forwarding: ${type}`,
        details,
        pairId,
        severity: 'info'
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

// Export singleton instance
export const forwardingService = MessageForwardingService.getInstance();