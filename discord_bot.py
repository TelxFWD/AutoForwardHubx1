"""
AutoForwardX Discord Bot
Monitors webhook messages, handles edits/deletes, and forwards clean content to Telegram
"""

import asyncio
import json
import logging
import os
import sys
import hashlib
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime, timedelta

import discord
from discord.ext import commands, tasks
import aiohttp

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/discord_bot.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class MessageCleaner:
    """Advanced message cleaning system for Discord to Telegram forwarding"""
    
    def __init__(self):
        self.config_file = Path('cleaner_config.json')
        self.edit_counts: Dict[str, int] = {}
        self.config = self.load_config()
        self.cleaner_logger = self._setup_cleaner_logger()
    
    def _setup_cleaner_logger(self):
        """Setup dedicated logger for message cleaning"""
        cleaner_logger = logging.getLogger('discord_cleaner')
        cleaner_logger.setLevel(logging.INFO)
        
        # Create logs directory if it doesn't exist
        Path('logs').mkdir(exist_ok=True)
        
        # File handler for cleaner logs
        handler = logging.FileHandler('logs/discord_cleaner.log')
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        cleaner_logger.addHandler(handler)
        
        return cleaner_logger
    
    def load_config(self) -> Dict[str, Any]:
        """Load cleaning configuration from JSON file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                self.cleaner_logger.error(f"Config file {self.config_file} not found")
                return self._get_default_config()
        except Exception as e:
            self.cleaner_logger.error(f"Error loading cleaner config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default cleaning configuration"""
        return {
            "header_patterns": ["^#\\w+", "^(VIP|🔥|ENTRY)\\b", "^[*]{2,}.*[*]{2,}$"],
            "footer_patterns": ["shared by .*", "autocopy.*", "join .*"],
            "mention_patterns": ["@\\w+", "@everyone", "@here"],
            "spam_patterns": ["🔥{3,}", "!{3,}", "\\?{3,}", "\\.{4,}"],
            "edit_trap_threshold": 3,
            "max_message_length": 4000
        }
    
    def clean_discord_message(self, text: str, message_id: str = None) -> Tuple[str, bool]:
        """
        Main message cleaning function
        
        Args:
            text: Raw Discord message text
            message_id: Discord message ID for edit tracking
            
        Returns:
            Tuple[cleaned_text, is_trap]
        """
        if not text or not text.strip():
            return "", False
        
        original_text = text
        is_trap = False
        trap_reasons = []
        
        try:
            # 1. Check for edit traps
            if message_id:
                edit_count = self.edit_counts.get(message_id, 0)
                if edit_count >= self.config.get('edit_trap_threshold', 3):
                    is_trap = True
                    trap_reasons.append(f"edit_trap_count_{edit_count}")
                    self.cleaner_logger.warning(f"Edit trap detected for message {message_id}: {edit_count} edits")
            
            # 2. Remove mentions while preserving context
            text = self._remove_mentions(text)
            
            # 3. Remove header patterns
            text, header_removed = self._remove_header_patterns(text)
            if header_removed:
                trap_reasons.append("header_pattern")
            
            # 4. Remove footer patterns
            text, footer_removed = self._remove_footer_patterns(text)
            if footer_removed:
                trap_reasons.append("footer_pattern")
            
            # 5. Clean spam patterns while preserving formatting
            text = self._clean_spam_patterns(text)
            
            # 6. Normalize formatting
            text = self._normalize_formatting(text)
            
            # 7. Check for specific trap text patterns
            text = text.strip()
            trap_patterns = self.config.get('trap_text_patterns', [])
            for pattern in trap_patterns:
                if re.match(pattern, text, re.IGNORECASE):
                    is_trap = True
                    trap_reasons.append(f"trap_pattern_{pattern}")
                    break
            
            # 8. Final validation
            # Check if message became empty or too short after cleaning
            if len(text) < 3 or text.lower() in ['...', '..', '.', 'edit', 'deleted']:
                is_trap = True
                trap_reasons.append("content_too_short")
            
            # Check maximum length
            if len(text) > self.config.get('max_message_length', 4000):
                text = text[:self.config.get('max_message_length', 4000)] + "..."
                self.cleaner_logger.info(f"Message truncated to {self.config.get('max_message_length', 4000)} characters")
            
            # Log cleaning action
            if trap_reasons or len(text) != len(original_text):
                self.cleaner_logger.info(
                    f"Message cleaned: trap={is_trap}, reasons={trap_reasons}, "
                    f"original_length={len(original_text)}, cleaned_length={len(text)}"
                )
            
            return text, is_trap
            
        except Exception as e:
            self.cleaner_logger.error(f"Error cleaning message: {e}")
            return original_text, False
    
    def _remove_mentions(self, text: str) -> str:
        """Remove Discord mentions while preserving context"""
        mention_patterns = self.config.get('mention_patterns', ['@\\w+', '@everyone', '@here'])
        
        for pattern in mention_patterns:
            # Remove mentions but preserve surrounding context
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)
        
        # Clean up extra whitespace left by mention removal
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _remove_header_patterns(self, text: str) -> Tuple[str, bool]:
        """Remove header trap patterns"""
        lines = text.split('\n')
        header_patterns = self.config.get('header_patterns', [])
        removed = False
        
        # Remove lines from the beginning that match header patterns
        while lines and header_patterns:
            line = lines[0].strip()
            if not line:
                lines.pop(0)
                continue
                
            line_removed = False
            for pattern in header_patterns:
                if re.match(pattern, line, re.IGNORECASE | re.UNICODE):
                    lines.pop(0)
                    removed = True
                    line_removed = True
                    self.cleaner_logger.info(f"Removed header pattern: {line[:50]}...")
                    break
            
            if not line_removed:
                break
        
        return '\n'.join(lines), removed
    
    def _remove_footer_patterns(self, text: str) -> Tuple[str, bool]:
        """Remove footer trap patterns"""
        lines = text.split('\n')
        footer_patterns = self.config.get('footer_patterns', [])
        removed = False
        
        # Remove lines from the end that match footer patterns
        while lines and footer_patterns:
            line = lines[-1].strip()
            if not line:
                lines.pop()
                continue
                
            line_removed = False
            for pattern in footer_patterns:
                if re.search(pattern, line, re.IGNORECASE | re.UNICODE):
                    lines.pop()
                    removed = True
                    line_removed = True
                    self.cleaner_logger.info(f"Removed footer pattern: {line[:50]}...")
                    break
            
            if not line_removed:
                break
        
        return '\n'.join(lines), removed
    
    def _clean_spam_patterns(self, text: str) -> str:
        """Clean spam patterns while preserving formatting"""
        spam_patterns = self.config.get('spam_patterns', [])
        
        for pattern in spam_patterns:
            if pattern == "🔥{3,}":
                # Replace multiple fire emojis with single one
                text = re.sub(r'🔥{3,}', '🔥', text)
            elif pattern == "!{3,}":
                # Replace multiple exclamation marks with single one
                text = re.sub(r'!{3,}', '!', text)
            elif pattern == "\\?{3,}":
                # Replace multiple question marks with single one
                text = re.sub(r'\?{3,}', '?', text)
            elif pattern == "\\.{4,}":
                # Replace multiple dots with ellipsis
                text = re.sub(r'\.{4,}', '...', text)
            else:
                # Generic pattern replacement
                text = re.sub(pattern, '', text)
        
        return text
    
    def _normalize_formatting(self, text: str) -> str:
        """Normalize formatting while preserving Telegram-compatible formatting"""
        # Preserve important formatting patterns for Telegram
        # Bold: **text** or __text__ -> keep as is
        # Italic: *text* or _text_ -> keep as is
        # Links: [text](url) -> keep as is
        
        # Remove excessive whitespace but preserve paragraph breaks
        text = re.sub(r' +', ' ', text)  # Multiple spaces to single space
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Multiple newlines to double newline
        text = re.sub(r'^\s+|\s+$', '', text, flags=re.MULTILINE)  # Trim line whitespace
        
        return text.strip()
    
    def increment_edit_count(self, message_id: str) -> int:
        """Increment edit count for a message and return new count"""
        if message_id not in self.edit_counts:
            self.edit_counts[message_id] = 0
        self.edit_counts[message_id] += 1
        
        count = self.edit_counts[message_id]
        self.cleaner_logger.info(f"Message {message_id} edit count: {count}")
        
        return count
    
    def cleanup_old_edit_counts(self, max_age_hours: int = 24):
        """Clean up old edit count entries"""
        # In a real implementation, you'd track timestamps
        # For now, just limit the size of the dict
        if len(self.edit_counts) > 1000:
            # Remove oldest entries (simplified approach)
            oldest_keys = list(self.edit_counts.keys())[:500]
            for key in oldest_keys:
                del self.edit_counts[key]
            self.cleaner_logger.info("Cleaned up old edit counts")

class MessageMapping:
    """Track message relationships between Discord and Telegram"""
    
    def __init__(self):
        self.mappings: Dict[str, Dict] = {}
        self.mappings_file = Path('telegram_reader/config/message_mappings.json')
        self.load_mappings()
    
    def load_mappings(self):
        """Load message mappings from file"""
        try:
            if self.mappings_file.exists():
                with open(self.mappings_file, 'r') as f:
                    self.mappings = json.load(f)
        except Exception as e:
            logger.error(f"Error loading message mappings: {e}")
            self.mappings = {}
    
    def save_mappings(self):
        """Save message mappings to file"""
        try:
            self.mappings_file.parent.mkdir(exist_ok=True)
            with open(self.mappings_file, 'w') as f:
                json.dump(self.mappings, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving message mappings: {e}")
    
    def add_mapping(self, discord_msg_id: str, telegram_msg_id: str, pair_name: str):
        """Add a new message mapping"""
        self.mappings[discord_msg_id] = {
            'telegram_msg_id': telegram_msg_id,
            'pair_name': pair_name,
            'timestamp': datetime.now().isoformat(),
            'edit_count': 0
        }
        self.save_mappings()
    
    def get_mapping(self, discord_msg_id: str) -> Optional[Dict]:
        """Get mapping for a Discord message"""
        return self.mappings.get(discord_msg_id)
    
    def increment_edit_count(self, discord_msg_id: str) -> int:
        """Increment edit count and return new count"""
        if discord_msg_id in self.mappings:
            self.mappings[discord_msg_id]['edit_count'] += 1
            self.save_mappings()
            return self.mappings[discord_msg_id]['edit_count']
        return 0

class TelegramPoster:
    """Handle posting messages to Telegram channels"""
    
    def __init__(self):
        self.bot_tokens = self.load_bot_tokens()
    
    def load_bot_tokens(self) -> Dict[str, str]:
        """Load bot tokens from configuration"""
        try:
            with open('telegram_reader/config/bot_tokens.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning("Bot tokens file not found, creating default")
            default_tokens = {
                "default": os.getenv('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE')
            }
            Path('telegram_reader/config').mkdir(exist_ok=True)
            with open('telegram_reader/config/bot_tokens.json', 'w') as f:
                json.dump(default_tokens, f, indent=2)
            return default_tokens
        except Exception as e:
            logger.error(f"Error loading bot tokens: {e}")
            return {}
    
    async def post_to_telegram(self, message_content: str, pair_config: Dict, 
                              original_discord_id: str) -> Optional[str]:
        """Post message to Telegram and return message ID"""
        try:
            bot_token = pair_config.get('bot_token') or self.bot_tokens.get('default')
            if not bot_token or bot_token == 'YOUR_BOT_TOKEN_HERE':
                logger.error(f"No valid bot token for pair: {pair_config.get('pair_name')}")
                return None
            
            destination_channel = pair_config.get('destination_tg_channel')
            if not destination_channel:
                logger.error(f"No destination channel for pair: {pair_config.get('pair_name')}")
                return None
            
            # Prepare message for Telegram
            cleaned_content = self.clean_message_for_telegram(message_content)
            
            # Send to Telegram
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                'chat_id': destination_channel,
                'text': cleaned_content,
                'parse_mode': 'HTML',
                'disable_web_page_preview': True
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        telegram_msg_id = str(result['result']['message_id'])
                        logger.info(f"Posted to Telegram: {pair_config.get('pair_name')}")
                        return telegram_msg_id
                    else:
                        error_text = await response.text()
                        logger.error(f"Telegram API error {response.status}: {error_text}")
                        return None
        
        except Exception as e:
            logger.error(f"Error posting to Telegram: {e}")
            return None
    
    def clean_message_for_telegram(self, content: str) -> str:
        """Clean Discord message content for Telegram"""
        # Remove Discord-specific formatting
        content = content.replace('**From ', 'From ')
        content = content.replace(':**\n', ':\n')
        
        # Handle Discord mentions and formatting
        content = content.replace('@everyone', '')
        content = content.replace('@here', '')
        
        # Limit length
        if len(content) > 4000:
            content = content[:3900] + "... (message truncated)"
        
        return content.strip()

class AutoForwardXBot(commands.Bot):
    """Main Discord bot class"""
    
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.guilds = True
        
        super().__init__(command_prefix='!', intents=intents)
        
        self.message_mapping = MessageMapping()
        self.message_cleaner = MessageCleaner()  # Initialize the message cleaner
        
        # Import enhanced poster
        import sys
        sys.path.append('.')
        from telegram_poster_enhanced import TelegramPosterEnhanced
        self.telegram_poster = TelegramPosterEnhanced()
        self.pairs_config = self.load_pairs_config()
        self.webhook_channels = self.get_webhook_channels()
        self.edit_threshold = 3
        
        # Load blocklist
        self.load_blocklist()
    
    def load_pairs_config(self) -> List[Dict]:
        """Load pairs configuration"""
        try:
            with open('telegram_reader/config/pairs.json', 'r') as f:
                pairs = json.load(f)
                return [pair for pair in pairs if pair.get('status') == 'active']
        except Exception as e:
            logger.error(f"Error loading pairs config: {e}")
            return []
    
    def get_webhook_channels(self) -> set:
        """Extract webhook channel IDs from pairs configuration"""
        channels = set()
        for pair in self.pairs_config:
            webhook_url = pair.get('discord_webhook', '')
            if webhook_url:
                # Extract channel ID from webhook URL
                parts = webhook_url.split('/')
                if len(parts) >= 6:
                    try:
                        channel_id = int(parts[5])  # Discord webhook URL format
                        channels.add(channel_id)
                    except ValueError:
                        logger.warning(f"Invalid channel ID in webhook URL: {webhook_url}")
        return channels
    
    def load_blocklist(self):
        """Load blocklist configuration"""
        try:
            with open('telegram_reader/config/blocklist.json', 'r') as f:
                self.blocklist = json.load(f)
        except Exception as e:
            logger.error(f"Error loading blocklist: {e}")
            self.blocklist = {"global_blocklist": {"text": [], "images": []}, "pair_blocklist": {}}
    
    def find_pair_by_channel(self, channel_id: int) -> Optional[Dict]:
        """Find pair configuration by Discord channel ID"""
        for pair in self.pairs_config:
            webhook_url = pair.get('discord_webhook', '')
            if webhook_url and str(channel_id) in webhook_url:
                return pair
        return None
    
    def is_text_blocked(self, text: str, pair_name: str) -> bool:
        """Check if text contains blocked content"""
        text_lower = text.lower()
        
        # Check global blocklist
        for blocked in self.blocklist.get('global_blocklist', {}).get('text', []):
            if blocked.lower() in text_lower:
                return True
        
        # Check pair-specific blocklist
        pair_blocklist = self.blocklist.get('pair_blocklist', {}).get(pair_name, {})
        for blocked in pair_blocklist.get('text', []):
            if blocked.lower() in text_lower:
                return True
        
        return False
    
    def detect_trap_patterns(self, content: str) -> Optional[str]:
        """Detect known trap patterns"""
        content_lower = content.lower().strip()
        
        trap_patterns = [
            ('/ *', 'forward_slash_trap'),
            ('1', 'single_digit_trap'),
            ('trap', 'explicit_trap'),
            ('leak', 'leak_warning'),
            ('copy warning', 'copy_warning')
        ]
        
        for pattern, trap_type in trap_patterns:
            if pattern in content_lower:
                return trap_type
        
        return None
    
    async def on_ready(self):
        """Bot ready event"""
        logger.info(f"Discord bot ready: {self.user}")
        logger.info(f"Monitoring {len(self.webhook_channels)} webhook channels")
        logger.info(f"Managing {len(self.pairs_config)} active pairs")
        
        # Start periodic tasks
        self.cleanup_old_mappings.start()
    
    async def on_message(self, message):
        """Handle incoming messages"""
        # Skip if not bot message or not in monitored channels
        if not message.author.bot or message.channel.id not in self.webhook_channels:
            return
        
        # Only process webhook messages from AutoForwardX
        if not ("AutoForwardX" in (message.author.display_name or "")):
            return
        
        # Find corresponding pair
        pair_config = self.find_pair_by_channel(message.channel.id)
        if not pair_config:
            logger.warning(f"No pair found for channel: {message.channel.id}")
            return
        
        # Extract original content from embed or message
        raw_content = self.extract_message_content(message)
        if not raw_content:
            return
        
        # Use the advanced message cleaner
        cleaned_content, is_trap = self.message_cleaner.clean_discord_message(
            raw_content, str(message.id)
        )
        
        if is_trap:
            logger.warning(f"Message marked as trap by cleaner in pair: {pair_config['pair_name']}")
            await self.handle_trap_detection("advanced_cleaner_trap", pair_config, message)
            return
        
        if not cleaned_content or len(cleaned_content.strip()) < 3:
            logger.info(f"Message too short after cleaning in pair {pair_config['pair_name']}")
            return
        
        # Legacy blocklist check (for backward compatibility)
        if self.is_text_blocked(cleaned_content, pair_config['pair_name']):
            logger.warning(f"Blocked content detected in pair: {pair_config['pair_name']}")
            return
        
        # Legacy trap detection (for backward compatibility)
        trap_type = self.detect_trap_patterns(cleaned_content)
        if trap_type:
            logger.warning(f"Legacy trap detected ({trap_type}) in pair: {pair_config['pair_name']}")
            await self.handle_trap_detection(trap_type, pair_config, message)
            return
        
        # Forward cleaned content to Telegram
        telegram_msg_id = await self.telegram_poster.post_to_telegram(
            cleaned_content, pair_config, str(message.id)
        )
        
        if telegram_msg_id:
            # Store mapping
            self.message_mapping.add_mapping(
                str(message.id), telegram_msg_id, pair_config['pair_name']
            )
            logger.info(f"Message forwarded: Discord {message.id} to Telegram {telegram_msg_id}")
    
    def extract_message_content(self, message) -> Optional[str]:
        """Extract meaningful content from Discord message"""
        # Check embeds first
        if message.embeds:
            embed = message.embeds[0]
            if embed.description:
                return embed.description
        
        # Fall back to message content
        content = message.content
        if content and "**From " in content:
            # Extract content after the "From channel:" part
            lines = content.split('\n')
            if len(lines) > 1:
                return '\n'.join(lines[1:]).strip()
        
        return content.strip() if content else None
    
    async def handle_trap_detection(self, trap_type: str, pair_config: Dict, message):
        """Handle trap detection"""
        pair_name = pair_config['pair_name']
        logger.warning(f"Trap detected: {trap_type} in pair {pair_name}")
        
        # Add reaction to mark as trapped
        try:
            await message.add_reaction('🚨')
        except Exception as e:
            logger.error(f"Failed to add reaction: {e}")
    
    async def on_message_edit(self, before, after):
        """Handle message edits for synchronization"""
        # Skip if not bot message or not in monitored channels
        if not after.author.bot or after.channel.id not in self.webhook_channels:
            return
        
        # Only process webhook messages from AutoForwardX
        if not ("AutoForwardX" in (after.author.display_name or "")):
            return
        
        # Get message mapping
        mapping = self.message_mapping.get_mapping(str(after.id))
        if not mapping:
            return
        
        # Use the message cleaner's edit tracking
        edit_count = self.message_cleaner.increment_edit_count(str(after.id))
        
        # Also update legacy mapping for compatibility
        legacy_count = self.message_mapping.increment_edit_count(str(after.id))
        
        if edit_count >= self.message_cleaner.config.get('edit_trap_threshold', 3):
            logger.warning(f"Edit trap detected by cleaner: {mapping['pair_name']} (count: {edit_count})")
            # Find pair config and handle trap
            pair_config = self.find_pair_by_channel(after.channel.id)
            if pair_config:
                await self.handle_trap_detection("edit_trap_cleaner", pair_config, after)
            return
        
        # Extract new content
        new_content = self.extract_message_content(after)
        if not new_content:
            return
        
        # Find pair configuration
        pair_config = self.find_pair_by_channel(after.channel.id)
        if not pair_config:
            return
        
        # Check for blocked content
        if self.is_text_blocked(new_content, pair_config['pair_name']):
            logger.warning(f"Edited message blocked: {pair_config['pair_name']}")
            return
        
        # Edit Telegram message
        bot_token = pair_config.get('bot_token')
        if bot_token:
            success = await self.telegram_poster.handle_source_edit(
                str(after.id), 
                new_content, 
                bot_token
            )
        
        if success:
            logger.info(f"Message edit synced: Discord {after.id} to Telegram {mapping['telegram_msg_id']}")
    
    async def on_message_delete(self, message):
        """Handle message deletions for synchronization"""
        # Skip if not bot message or not in monitored channels
        if not message.author.bot or message.channel.id not in self.webhook_channels:
            return
        
        # Get message mapping
        mapping = self.message_mapping.get_mapping(str(message.id))
        if not mapping:
            return
        
        # Find pair configuration
        pair_config = self.find_pair_by_channel(message.channel.id)
        if not pair_config:
            return
        
        # Delete Telegram message
        bot_token = pair_config.get('bot_token')
        if bot_token:
            success = await self.telegram_poster.handle_source_delete(
                str(message.id), 
                bot_token
            )
        
        if success:
            # Remove mapping
            if str(message.id) in self.message_mapping.mappings:
                del self.message_mapping.mappings[str(message.id)]
                self.message_mapping.save_mappings()
            
            logger.info(f"Message deletion synced: Discord {message.id} to Telegram {mapping['telegram_msg_id']}")
    
    @tasks.loop(hours=24)
    async def cleanup_old_mappings(self):
        """Clean up old message mappings"""
        try:
            current_time = datetime.now()
            cutoff_time = current_time - timedelta(days=7)  # Keep mappings for 7 days
            
            old_mappings = []
            for msg_id, mapping in self.message_mapping.mappings.items():
                mapping_time = datetime.fromisoformat(mapping['timestamp'])
                if mapping_time < cutoff_time:
                    old_mappings.append(msg_id)
            
            for msg_id in old_mappings:
                del self.message_mapping.mappings[msg_id]
            
            if old_mappings:
                self.message_mapping.save_mappings()
                logger.info(f"Cleaned up {len(old_mappings)} old message mappings")
        
        except Exception as e:
            logger.error(f"Error cleaning up mappings: {e}")

async def main():
    """Main entry point"""
    # Check for Discord bot token
    discord_token = os.getenv('DISCORD_BOT_TOKEN')
    if not discord_token:
        logger.error("DISCORD_BOT_TOKEN environment variable not set")
        sys.exit(1)
    
    # Create necessary directories
    for directory in ['telegram_reader/config', 'logs']:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    # Create bot instance
    bot = AutoForwardXBot()
    
    try:
        logger.info("Starting AutoForwardX Discord Bot...")
        await bot.start(discord_token)
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        await bot.close()

if __name__ == "__main__":
    asyncio.run(main())