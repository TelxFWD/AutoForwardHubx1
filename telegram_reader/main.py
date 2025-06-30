"""
AutoForwardX Telegram Message Reader
Enhanced multi-session Telethon client with comprehensive trap detection and Discord forwarding
"""

import asyncio
import json
import logging
import os
import sys
import hashlib
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime

from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument
import aiohttp
import aiofiles

from config import config_manager, PairConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/telegram_reader.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class TrapDetector:
    """Advanced trap detection system"""
    
    @staticmethod
    def detect_text_traps(text: str, pair_name: str) -> Dict[str, Any]:
        """Detect text-based traps and suspicious patterns"""
        result = {
            'is_trap': False,
            'trap_type': None,
            'confidence': 0.0,
            'details': []
        }
        
        if not text:
            return result
        
        # Check against blocklist
        if config_manager.is_text_blocked(text, pair_name):
            result.update({
                'is_trap': True,
                'trap_type': 'blocklist',
                'confidence': 1.0,
                'details': ['Text matches blocklist pattern']
            })
            return result
        
        # Known trap patterns
        trap_patterns = [
            ('/ *', 'forward_slash_trap', 0.9),
            ('1', 'single_digit_trap', 0.8),
            ('trap', 'explicit_trap', 0.95),
            ('leak', 'leak_warning', 0.9),
            ('copy warning', 'copy_warning', 0.85)
        ]
        
        text_lower = text.lower().strip()
        for pattern, trap_type, confidence in trap_patterns:
            if pattern in text_lower:
                result.update({
                    'is_trap': True,
                    'trap_type': trap_type,
                    'confidence': confidence,
                    'details': [f'Detected pattern: {pattern}']
                })
                return result
        
        # Suspicious short messages
        if len(text.strip()) <= 3 and text.strip().isdigit():
            result.update({
                'is_trap': True,
                'trap_type': 'suspicious_short',
                'confidence': 0.7,
                'details': ['Very short numeric message']
            })
        
        return result
    
    @staticmethod
    async def detect_image_traps(media_data: bytes, pair_name: str) -> Dict[str, Any]:
        """Detect image-based traps using hash comparison"""
        result = {
            'is_trap': False,
            'trap_type': None,
            'image_hash': None,
            'details': []
        }
        
        try:
            # Calculate MD5 hash of image
            image_hash = hashlib.md5(media_data).hexdigest()
            result['image_hash'] = image_hash
            
            # Check against blocklist
            if config_manager.is_image_blocked(image_hash, pair_name):
                result.update({
                    'is_trap': True,
                    'trap_type': 'blocklist_image',
                    'details': ['Image hash matches blocklist']
                })
            
        except Exception as e:
            logger.error(f"Error detecting image traps: {e}")
        
        return result

class MessageTracker:
    """Track message edits and detect excessive editing"""
    
    def __init__(self):
        self.edit_counts: Dict[int, int] = {}
        self.edit_threshold = 3
    
    def track_edit(self, message_id: int) -> bool:
        """Track message edit and return True if threshold exceeded"""
        self.edit_counts[message_id] = self.edit_counts.get(message_id, 0) + 1
        return self.edit_counts[message_id] > self.edit_threshold
    
    def reset_tracking(self, message_id: int):
        """Reset edit tracking for a message"""
        self.edit_counts.pop(message_id, None)

class TelegramMessageReader:
    """Enhanced main class for handling multiple Telegram sessions and message forwarding"""
    
    def __init__(self):
        self.clients: Dict[str, TelegramClient] = {}
        self.pairs: List[PairConfig] = []
        self.running = False
        self.trap_detector = TrapDetector()
        self.message_tracker = MessageTracker()
        self.admin_bot_token = os.getenv('ADMIN_BOT_TOKEN')
        
    async def load_config(self):
        """Load sessions and pairs configuration"""
        try:
            self.pairs = config_manager.get_active_pairs()
            logger.info(f"Loaded {len(self.pairs)} active pairs")
            
            sessions = config_manager.get_active_sessions()
            logger.info(f"Loaded {len(sessions)} active sessions")
            
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            raise
    
    async def create_clients(self):
        """Create Telethon clients for each active session"""
        sessions = config_manager.get_active_sessions()
        
        for session_name, session_config in sessions.items():
            try:
                # Create client with session file
                session_file = f"sessions/{session_config.session_file}"
                client = TelegramClient(
                    session_file,
                    api_id=int(os.getenv('TELEGRAM_API_ID', '0')),
                    api_hash=os.getenv('TELEGRAM_API_HASH', '')
                )
                
                await client.start()
                self.clients[session_name] = client
                
                # Register event handlers
                client.add_event_handler(self.handle_new_message, events.NewMessage())
                client.add_event_handler(self.handle_message_edit, events.MessageEdited())
                
                logger.info(f"Successfully connected session: {session_name}")
                
            except Exception as e:
                logger.error(f"Failed to connect session {session_name}: {e}")
                config_manager.update_session_status(session_name, "error")
    
    async def handle_new_message(self, event):
        """Handle new messages with comprehensive processing"""
        try:
            message = event.message
            chat = await event.get_chat()
            
            # Find matching pair
            matching_pair = self.find_matching_pair(chat)
            if not matching_pair:
                return
            
            # Process message content
            message_data = await self.process_message_content(message, chat, matching_pair)
            
            # Detect traps
            trap_result = await self.detect_traps(message_data, matching_pair)
            
            if trap_result['is_trap']:
                await self.handle_trap_detection(trap_result, matching_pair, message_data)
                return
            
            # Forward to Discord if clean
            await self.forward_to_discord(message_data, matching_pair)
            
        except Exception as e:
            logger.error(f"Error handling new message: {e}")
    
    async def handle_message_edit(self, event):
        """Handle message edits and detect excessive editing"""
        try:
            message = event.message
            chat = await event.get_chat()
            
            # Check if edit threshold exceeded
            if self.message_tracker.track_edit(message.id):
                matching_pair = self.find_matching_pair(chat)
                if matching_pair:
                    await self.handle_excessive_edits(message, matching_pair)
                return
            
            # Process edited message normally
            await self.handle_new_message(event)
            
        except Exception as e:
            logger.error(f"Error handling message edit: {e}")
    
    def find_matching_pair(self, chat) -> Optional[PairConfig]:
        """Find matching pair configuration for a chat"""
        for pair in self.pairs:
            if pair.status != "active":
                continue
                
            source_channel = pair.source_channel.replace('@', '')
            if hasattr(chat, 'username') and chat.username == source_channel:
                return pair
            elif str(chat.id) == pair.source_channel:
                return pair
        
        return None
    
    async def process_message_content(self, message, chat, pair: PairConfig) -> Dict[str, Any]:
        """Process and extract message content"""
        message_data = {
            'text': message.text or "",
            'message_id': message.id,
            'channel': chat.username if hasattr(chat, 'username') else str(chat.id),
            'channel_title': chat.title if hasattr(chat, 'title') else 'Unknown',
            'timestamp': message.date.isoformat(),
            'pair_name': pair.pair_name,
            'has_media': bool(message.media),
            'media_data': None,
            'formatting': self.extract_formatting(message)
        }
        
        # Handle media
        if message.media:
            message_data['media_type'] = type(message.media).__name__
            
            # Download media for trap detection
            if isinstance(message.media, (MessageMediaPhoto, MessageMediaDocument)):
                try:
                    media_bytes = await message.download_media(bytes)
                    message_data['media_data'] = media_bytes
                except Exception as e:
                    logger.error(f"Error downloading media: {e}")
        
        return message_data
    
    def extract_formatting(self, message) -> Dict[str, Any]:
        """Extract message formatting information"""
        formatting = {
            'entities': [],
            'has_formatting': False
        }
        
        if message.entities:
            formatting['has_formatting'] = True
            for entity in message.entities:
                formatting['entities'].append({
                    'type': type(entity).__name__,
                    'offset': entity.offset,
                    'length': entity.length
                })
        
        return formatting
    
    async def detect_traps(self, message_data: Dict[str, Any], pair: PairConfig) -> Dict[str, Any]:
        """Comprehensive trap detection"""
        # Text trap detection
        text_result = self.trap_detector.detect_text_traps(message_data['text'], pair.pair_name)
        
        # Image trap detection
        image_result = {'is_trap': False}
        if message_data['media_data']:
            image_result = await self.trap_detector.detect_image_traps(
                message_data['media_data'], pair.pair_name
            )
        
        # Combine results
        if text_result['is_trap'] or image_result['is_trap']:
            return {
                'is_trap': True,
                'text_trap': text_result,
                'image_trap': image_result,
                'primary_type': text_result['trap_type'] if text_result['is_trap'] else image_result['trap_type']
            }
        
        return {'is_trap': False}
    
    async def handle_trap_detection(self, trap_result: Dict[str, Any], pair: PairConfig, message_data: Dict[str, Any]):
        """Handle detected traps"""
        logger.warning(f"Trap detected in pair {pair.pair_name}: {trap_result['primary_type']}")
        
        # Auto-pause pair if high confidence trap
        if trap_result.get('text_trap', {}).get('confidence', 0) > 0.8:
            config_manager.update_pair_status(pair.pair_name, "paused")
            logger.info(f"Auto-paused pair {pair.pair_name} due to trap detection")
            
            # Notify admin bot
            await self.notify_admin_bot(
                f"🚨 TRAP DETECTED\n"
                f"Pair: {pair.pair_name}\n"
                f"Type: {trap_result['primary_type']}\n"
                f"Auto-paused for safety"
            )
    
    async def handle_excessive_edits(self, message, pair: PairConfig):
        """Handle excessive message edits"""
        logger.warning(f"Excessive edits detected in pair {pair.pair_name}")
        
        # Pause pair temporarily
        config_manager.update_pair_status(pair.pair_name, "paused")
        
        await self.notify_admin_bot(
            f"⚠️ EXCESSIVE EDITS\n"
            f"Pair: {pair.pair_name}\n"
            f"Message edited >3 times\n"
            f"Pair auto-paused"
        )
        
        # Schedule auto-resume after 2 minutes
        asyncio.create_task(self.auto_resume_pair(pair.pair_name, 120))
    
    async def auto_resume_pair(self, pair_name: str, delay_seconds: int):
        """Auto-resume pair after delay"""
        await asyncio.sleep(delay_seconds)
        config_manager.update_pair_status(pair_name, "active")
        logger.info(f"Auto-resumed pair {pair_name}")
        
        await self.notify_admin_bot(
            f"✅ AUTO-RESUMED\n"
            f"Pair: {pair_name}\n"
            f"Cooldown period completed"
        )
    
    async def forward_to_discord(self, message_data: Dict[str, Any], pair: PairConfig):
        """Enhanced Discord forwarding with formatting preservation"""
        try:
            webhook_url = pair.discord_webhook
            if not webhook_url:
                logger.warning(f"No Discord webhook configured for pair: {pair.pair_name}")
                return
            
            # Prepare enhanced payload
            content = f"**From {message_data['channel_title']}:**\n{message_data['text']}"
            
            payload = {
                'content': content[:2000],  # Discord limit
                'username': f"AutoForwardX - {pair.pair_name}",
                'embeds': [{
                    'title': f"📨 {message_data['channel_title']}",
                    'description': message_data['text'][:4000] if message_data['text'] else "Media message",
                    'color': 0x00ff00,
                    'timestamp': message_data['timestamp'],
                    'footer': {
                        'text': f"Pair: {pair.pair_name} | ID: {message_data['message_id']}"
                    },
                    'fields': []
                }]
            }
            
            # Add formatting info if present
            if message_data['formatting']['has_formatting']:
                payload['embeds'][0]['fields'].append({
                    'name': 'Formatting',
                    'value': f"{len(message_data['formatting']['entities'])} entities",
                    'inline': True
                })
            
            # Add media info
            if message_data['has_media']:
                payload['embeds'][0]['fields'].append({
                    'name': 'Media',
                    'value': message_data.get('media_type', 'Unknown'),
                    'inline': True
                })
            
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as response:
                    if response.status == 204:
                        logger.info(f"✅ Forwarded to Discord: {pair.pair_name}")
                    else:
                        logger.error(f"❌ Discord webhook failed {response.status}: {await response.text()}")
                        
        except Exception as e:
            logger.error(f"Error forwarding to Discord: {e}")
    
    async def notify_admin_bot(self, message: str):
        """Send notification to admin bot"""
        if not self.admin_bot_token:
            logger.warning("Admin bot token not configured")
            return
        
        try:
            admin_chat_id = os.getenv('ADMIN_CHAT_ID')
            if not admin_chat_id:
                return
            
            url = f"https://api.telegram.org/bot{self.admin_bot_token}/sendMessage"
            payload = {
                'chat_id': admin_chat_id,
                'text': message,
                'parse_mode': 'HTML'
            }
            
            async with aiohttp.ClientSession() as session:
                await session.post(url, json=payload)
                
        except Exception as e:
            logger.error(f"Error notifying admin bot: {e}")
    
    async def run(self):
        """Enhanced main run loop"""
        logger.info("🚀 Starting AutoForwardX Telegram Message Reader...")
        
        try:
            await self.load_config()
            await self.create_clients()
            
            if not self.clients:
                logger.error("❌ No active clients available. Exiting.")
                return
            
            self.running = True
            logger.info(f"✅ Message reader started with {len(self.clients)} active sessions")
            logger.info(f"📊 Monitoring {len(self.pairs)} active pairs")
            
            # Keep running
            while self.running:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("⚠️ Received interrupt signal, shutting down...")
        except Exception as e:
            logger.error(f"💥 Fatal error in main loop: {e}")
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """Enhanced cleanup with proper resource management"""
        logger.info("🧹 Cleaning up resources...")
        
        for session_name, client in self.clients.items():
            try:
                await client.disconnect()
                logger.info(f"✅ Disconnected session: {session_name}")
            except Exception as e:
                logger.error(f"❌ Error disconnecting session {session_name}: {e}")
        
        self.running = False
        logger.info("🔒 Cleanup completed")

async def main():
    """Enhanced main entry point with environment validation"""
    # Check for required environment variables
    required_vars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {missing_vars}")
        sys.exit(1)
    
    # Create necessary directories
    for directory in ['config', 'sessions', 'logs']:
        Path(directory).mkdir(exist_ok=True)
    
    logger.info("🎯 AutoForwardX System Starting...")
    
    # Start the enhanced message reader
    reader = TelegramMessageReader()
    await reader.run()

if __name__ == "__main__":
    asyncio.run(main())