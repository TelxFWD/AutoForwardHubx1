"""
Enhanced Telegram Poster for AutoForwardX
Supports posting, editing, and deleting messages with Pyrogram
"""

import asyncio
import json
import logging
import os
import sys
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from datetime import datetime

from pyrogram import Client, errors
from pyrogram.types import Message
from retry_util import telegram_retry, safe_telegram_operation, telegram_rate_limiter
import aiofiles

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/telegram_poster.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class MessageMappingManager:
    """Manages message ID mappings for edit/delete operations"""
    
    def __init__(self, mapping_file: str = "message_mappings.json"):
        self.mapping_file = Path(mapping_file)
        self.mappings: Dict[str, Dict] = {}
        self.load_mappings()
    
    def load_mappings(self):
        """Load message mappings from file"""
        try:
            if self.mapping_file.exists():
                with open(self.mapping_file, 'r', encoding='utf-8') as f:
                    self.mappings = json.load(f)
                logger.info(f"Loaded {len(self.mappings)} message mappings")
        except Exception as e:
            logger.error(f"Failed to load mappings: {e}")
            self.mappings = {}
    
    def save_mappings(self):
        """Save message mappings to file"""
        try:
            self.mapping_file.parent.mkdir(exist_ok=True)
            with open(self.mapping_file, 'w', encoding='utf-8') as f:
                json.dump(self.mappings, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save mappings: {e}")
    
    def add_mapping(self, source_id: str, telegram_msg_id: str, chat_id: str, pair_name: str):
        """Add a new message mapping"""
        self.mappings[source_id] = {
            "telegram_msg_id": telegram_msg_id,
            "chat_id": chat_id,
            "pair_name": pair_name,
            "timestamp": datetime.now().isoformat(),
            "edit_count": 0
        }
        self.save_mappings()
    
    def get_mapping(self, source_id: str) -> Optional[Dict]:
        """Get mapping for a source message"""
        return self.mappings.get(source_id)
    
    def remove_mapping(self, source_id: str):
        """Remove a message mapping"""
        if source_id in self.mappings:
            del self.mappings[source_id]
            self.save_mappings()
    
    def increment_edit_count(self, source_id: str) -> int:
        """Increment edit count and return new count"""
        if source_id in self.mappings:
            self.mappings[source_id]["edit_count"] += 1
            self.save_mappings()
            return self.mappings[source_id]["edit_count"]
        return 0

class TelegramPosterEnhanced:
    """Enhanced Telegram poster with edit/delete support"""
    
    def __init__(self):
        self.clients: Dict[str, Client] = {}
        self.mapping_manager = MessageMappingManager()
        self.session_configs = self.load_session_configs()
    
    def load_session_configs(self) -> Dict[str, Dict]:
        """Load session configurations"""
        try:
            config_file = Path("telegram_reader/config/sessions.json")
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load session configs: {e}")
        return {}
    
    async def get_client(self, bot_token: str) -> Client:
        """Get or create Pyrogram client for bot token"""
        if bot_token not in self.clients:
            try:
                # Extract bot ID from token for session name
                bot_id = bot_token.split(':')[0]
                session_name = f"poster_bot_{bot_id}"
                
                api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
                api_hash = os.getenv("TELEGRAM_API_HASH", "")
                
                if not api_id or not api_hash:
                    raise ValueError("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set")
                
                client = Client(
                    session_name,
                    api_id=api_id,
                    api_hash=api_hash,
                    bot_token=bot_token,
                    workdir="sessions"
                )
                
                await client.start()
                self.clients[bot_token] = client
                logger.info(f"Initialized Telegram bot client: {session_name}")
                
            except Exception as e:
                logger.error(f"Failed to initialize bot client: {e}")
                raise
        
        return self.clients[bot_token]
    
    def format_message_for_telegram(self, content: str, parse_mode: str = "HTML") -> str:
        """Format message content for Telegram"""
        if not content:
            return ""
        
        # Basic HTML/Markdown formatting preservation
        if parse_mode.upper() == "HTML":
            # Ensure HTML tags are properly formatted
            content = content.replace("**", "<b>").replace("**", "</b>")
            content = content.replace("*", "<i>").replace("*", "</i>")
            content = content.replace("__", "<u>").replace("__", "</u>")
            content = content.replace("`", "<code>").replace("`", "</code>")
        elif parse_mode.upper() == "MARKDOWN":
            # Keep Markdown formatting as-is
            pass
        
        # Clean up excessive whitespace
        lines = content.split('\n')
        cleaned_lines = []
        for line in lines:
            cleaned_lines.append(line.rstrip())
        
        return '\n'.join(cleaned_lines).strip()
    
    @telegram_retry
    async def post_to_telegram(
        self,
        content: str,
        chat_id: str,
        bot_token: str,
        source_id: str,
        pair_name: str,
        parse_mode: str = "HTML",
        disable_web_page_preview: bool = True
    ) -> Optional[str]:
        """
        Post message to Telegram channel
        
        Args:
            content: Message content
            chat_id: Telegram chat ID or username
            bot_token: Bot token to use
            source_id: Original message ID for mapping
            pair_name: Name of the pair for tracking
            parse_mode: HTML or Markdown
            disable_web_page_preview: Disable link previews
            
        Returns:
            Telegram message ID if successful, None otherwise
        """
        try:
            await telegram_rate_limiter.acquire()
            
            client = await self.get_client(bot_token)
            formatted_content = self.format_message_for_telegram(content, parse_mode)
            
            if not formatted_content:
                logger.warning(f"Empty content for pair {pair_name}, skipping")
                return None
            
            # Send message
            message = await client.send_message(
                chat_id=chat_id,
                text=formatted_content,
                parse_mode=parse_mode,
                disable_web_page_preview=disable_web_page_preview
            )
            
            telegram_msg_id = str(message.id)
            
            # Store mapping
            self.mapping_manager.add_mapping(
                source_id, telegram_msg_id, chat_id, pair_name
            )
            
            logger.info(f"Posted to Telegram {chat_id}: {telegram_msg_id} (pair: {pair_name})")
            return telegram_msg_id
            
        except errors.FloodWait as e:
            logger.warning(f"Rate limited for {e.value} seconds")
            await asyncio.sleep(e.value)
            # Retry after flood wait
            return await self.post_to_telegram(
                content, chat_id, bot_token, source_id, pair_name, parse_mode, disable_web_page_preview
            )
        except Exception as e:
            logger.error(f"Failed to post to Telegram {chat_id}: {e}")
            return None
    
    @telegram_retry
    async def edit_telegram_message(
        self,
        chat_id: str,
        message_id: str,
        new_content: str,
        bot_token: str,
        parse_mode: str = "HTML"
    ) -> bool:
        """
        Edit a Telegram message
        
        Args:
            chat_id: Telegram chat ID
            message_id: Message ID to edit
            new_content: New message content
            bot_token: Bot token to use
            parse_mode: HTML or Markdown
            
        Returns:
            True if successful, False otherwise
        """
        try:
            await telegram_rate_limiter.acquire()
            
            client = await self.get_client(bot_token)
            formatted_content = self.format_message_for_telegram(new_content, parse_mode)
            
            if not formatted_content:
                logger.warning(f"Empty content for edit, skipping")
                return False
            
            # Edit message
            await client.edit_message_text(
                chat_id=chat_id,
                message_id=int(message_id),
                text=formatted_content,
                parse_mode=parse_mode
            )
            
            logger.info(f"Edited Telegram message {message_id} in {chat_id}")
            return True
            
        except errors.MessageNotModified:
            logger.debug(f"Message {message_id} content unchanged")
            return True
        except errors.MessageCantBeEdited:
            logger.warning(f"Message {message_id} cannot be edited (too old or media message)")
            return False
        except errors.FloodWait as e:
            logger.warning(f"Rate limited for {e.value} seconds")
            await asyncio.sleep(e.value)
            # Retry after flood wait
            return await self.edit_telegram_message(
                chat_id, message_id, new_content, bot_token, parse_mode
            )
        except Exception as e:
            logger.error(f"Failed to edit Telegram message {message_id}: {e}")
            return False
    
    @telegram_retry
    async def delete_telegram_message(
        self,
        chat_id: str,
        message_id: str,
        bot_token: str
    ) -> bool:
        """
        Delete a Telegram message
        
        Args:
            chat_id: Telegram chat ID
            message_id: Message ID to delete
            bot_token: Bot token to use
            
        Returns:
            True if successful, False otherwise
        """
        try:
            await telegram_rate_limiter.acquire()
            
            client = await self.get_client(bot_token)
            
            # Delete message
            await client.delete_messages(
                chat_id=chat_id,
                message_ids=[int(message_id)]
            )
            
            logger.info(f"Deleted Telegram message {message_id} in {chat_id}")
            return True
            
        except errors.MessageDeleteForbidden:
            logger.warning(f"Cannot delete message {message_id} - insufficient permissions")
            return False
        except errors.MessageIdInvalid:
            logger.warning(f"Message {message_id} not found or already deleted")
            return True  # Consider already deleted as success
        except errors.FloodWait as e:
            logger.warning(f"Rate limited for {e.value} seconds")
            await asyncio.sleep(e.value)
            # Retry after flood wait
            return await self.delete_telegram_message(chat_id, message_id, bot_token)
        except Exception as e:
            logger.error(f"Failed to delete Telegram message {message_id}: {e}")
            return False
    
    async def handle_source_edit(self, source_id: str, new_content: str, bot_token: str) -> bool:
        """Handle edit from source message"""
        mapping = self.mapping_manager.get_mapping(source_id)
        if not mapping:
            logger.warning(f"No mapping found for source message {source_id}")
            return False
        
        # Increment edit count
        edit_count = self.mapping_manager.increment_edit_count(source_id)
        
        # Check for edit trap (3+ edits)
        if edit_count >= 3:
            logger.warning(f"Edit trap detected for message {source_id} (count: {edit_count})")
            # Could trigger pause logic here
            return False
        
        return await self.edit_telegram_message(
            mapping["chat_id"],
            mapping["telegram_msg_id"],
            new_content,
            bot_token
        )
    
    async def handle_source_delete(self, source_id: str, bot_token: str) -> bool:
        """Handle delete from source message"""
        mapping = self.mapping_manager.get_mapping(source_id)
        if not mapping:
            logger.warning(f"No mapping found for source message {source_id}")
            return False
        
        success = await self.delete_telegram_message(
            mapping["chat_id"],
            mapping["telegram_msg_id"],
            bot_token
        )
        
        if success:
            # Remove mapping after successful delete
            self.mapping_manager.remove_mapping(source_id)
        
        return success
    
    async def cleanup_old_messages(self, max_age_days: int = 7):
        """Clean up old message mappings"""
        from datetime import timedelta
        
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        old_mappings = []
        
        for source_id, mapping in self.mapping_manager.mappings.items():
            try:
                timestamp = datetime.fromisoformat(mapping["timestamp"])
                if timestamp < cutoff_date:
                    old_mappings.append(source_id)
            except (KeyError, ValueError):
                # Invalid timestamp, mark for cleanup
                old_mappings.append(source_id)
        
        for source_id in old_mappings:
            self.mapping_manager.remove_mapping(source_id)
        
        if old_mappings:
            logger.info(f"Cleaned up {len(old_mappings)} old message mappings")
    
    async def get_bot_info(self, bot_token: str) -> Optional[Dict]:
        """Get information about a bot"""
        try:
            client = await self.get_client(bot_token)
            bot = await client.get_me()
            return {
                "id": bot.id,
                "username": bot.username,
                "first_name": bot.first_name,
                "is_bot": bot.is_bot
            }
        except Exception as e:
            logger.error(f"Failed to get bot info: {e}")
            return None
    
    async def close(self):
        """Close all client connections"""
        for bot_token, client in self.clients.items():
            try:
                await client.stop()
                logger.info(f"Closed client for bot {bot_token[:10]}...")
            except Exception as e:
                logger.error(f"Error closing client: {e}")
        
        self.clients.clear()

# Global instance
telegram_poster = TelegramPosterEnhanced()

async def main():
    """Test the poster functionality"""
    try:
        bot_token = os.getenv("TEST_BOT_TOKEN")
        if not bot_token:
            logger.error("TEST_BOT_TOKEN not set")
            return
        
        chat_id = os.getenv("TEST_CHAT_ID")
        if not chat_id:
            logger.error("TEST_CHAT_ID not set")
            return
        
        # Test posting
        msg_id = await telegram_poster.post_to_telegram(
            content="Test message from enhanced poster",
            chat_id=chat_id,
            bot_token=bot_token,
            source_id="test_123",
            pair_name="test_pair"
        )
        
        if msg_id:
            logger.info(f"Posted message: {msg_id}")
            
            # Test editing
            await asyncio.sleep(2)
            await telegram_poster.edit_telegram_message(
                chat_id=chat_id,
                message_id=msg_id,
                new_content="<b>Edited</b> test message",
                bot_token=bot_token
            )
            
            # Test deletion
            await asyncio.sleep(2)
            await telegram_poster.delete_telegram_message(
                chat_id=chat_id,
                message_id=msg_id,
                bot_token=bot_token
            )
    
    except Exception as e:
        logger.error(f"Test failed: {e}")
    finally:
        await telegram_poster.close()

if __name__ == "__main__":
    asyncio.run(main())