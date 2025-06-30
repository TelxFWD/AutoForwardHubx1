"""
Advanced Telegram-to-Telegram Copier Module using Telethon
Multi-session support with trap detection and content filtering
"""

import asyncio
import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib

try:
    from telethon import TelegramClient, events
    from telethon.tl.types import Message, MessageMediaPhoto, MessageMediaDocument
    from telethon.errors import FloodWaitError, SessionPasswordNeededError
    from telethon.tl.functions.messages import GetHistoryRequest
except ImportError:
    print("Telethon not available - install with: pip install telethon")

from logging_config import get_logger
from retry_util import retry_async, safe_telegram_operation

# Setup logging
logger = get_logger("telegram_copier", {"component": "multi_session_copier"})

@dataclass
class StripRules:
    """Content filtering rules for messages"""
    remove_mentions: bool = True
    header_patterns: List[str] = None
    footer_patterns: List[str] = None
    
    def __post_init__(self):
        if self.header_patterns is None:
            self.header_patterns = []
        if self.footer_patterns is None:
            self.footer_patterns = []

@dataclass
class CopyPair:
    """Configuration for source -> destination channel pair"""
    source: str
    destination: str
    strip_rules: StripRules
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'CopyPair':
        strip_config = data.get('strip_rules', {})
        strip_rules = StripRules(
            remove_mentions=strip_config.get('remove_mentions', True),
            header_patterns=strip_config.get('header_patterns', []),
            footer_patterns=strip_config.get('footer_patterns', [])
        )
        return cls(
            source=data['source'],
            destination=data['destination'],
            strip_rules=strip_rules
        )

@dataclass
class UserConfig:
    """Configuration for individual user with their pairs"""
    user_id: str
    session_file: str
    pairs: List[CopyPair]
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'UserConfig':
        pairs = [CopyPair.from_dict(pair) for pair in data.get('pairs', [])]
        return cls(
            user_id=data['user_id'],
            session_file=data['session_file'],
            pairs=pairs
        )

class TrapDetector:
    """Detect trap messages using various patterns"""
    
    def __init__(self, blocklist_file: str = "blocklist.json"):
        self.blocklist_file = Path(blocklist_file)
        self.text_patterns: List[str] = []
        self.image_hashes: Set[str] = set()
        self.edit_counts: Dict[int, int] = {}
        self.load_blocklist()
    
    def load_blocklist(self):
        """Load blocklist patterns from file"""
        try:
            if self.blocklist_file.exists():
                with open(self.blocklist_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    global_rules = data.get('global', {})
                    self.text_patterns = global_rules.get('text_patterns', [])
                    self.image_hashes = set(global_rules.get('image_hashes', []))
                    logger.info(f"Loaded {len(self.text_patterns)} text patterns and {len(self.image_hashes)} image hashes")
        except Exception as e:
            logger.error(f"Failed to load blocklist: {e}")
    
    def is_text_trap(self, text: str) -> bool:
        """Check if text contains trap patterns"""
        if not text:
            return False
        
        text_lower = text.lower().strip()
        
        # Check against known patterns
        for pattern in self.text_patterns:
            try:
                if re.search(pattern.lower(), text_lower, re.IGNORECASE):
                    logger.warning(f"Text trap detected: pattern '{pattern}' in message")
                    return True
            except re.error:
                # If regex is invalid, do simple string match
                if pattern.lower() in text_lower:
                    logger.warning(f"Text trap detected: simple match '{pattern}' in message")
                    return True
        
        return False
    
    def is_image_trap(self, image_bytes: bytes) -> bool:
        """Check if image hash matches known trap images"""
        if not image_bytes:
            return False
        
        image_hash = hashlib.md5(image_bytes).hexdigest()
        is_trap = image_hash in self.image_hashes
        
        if is_trap:
            logger.warning(f"Image trap detected: hash {image_hash}")
        
        return is_trap
    
    def is_edit_trap(self, msg_id: int, increment: bool = True) -> bool:
        """Check if message has been edited too many times (edit trap)"""
        if increment:
            self.edit_counts[msg_id] = self.edit_counts.get(msg_id, 0) + 1
        
        edit_count = self.edit_counts.get(msg_id, 0)
        is_trap = edit_count >= 3
        
        if is_trap:
            logger.warning(f"Edit trap detected: message {msg_id} edited {edit_count} times")
        
        return is_trap

class MessageProcessor:
    """Process and filter message content"""
    
    @staticmethod
    def strip_custom_header_footer(text: str, strip_rules: StripRules) -> str:
        """Remove custom headers, footers, and mentions from text"""
        if not text:
            return text
        
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            # Skip empty lines
            if not line.strip():
                processed_lines.append(line)
                continue
            
            # Check header patterns
            skip_line = False
            for pattern in strip_rules.header_patterns:
                try:
                    if re.match(pattern, line.strip(), re.IGNORECASE):
                        skip_line = True
                        break
                except re.error:
                    # Fallback to simple string match
                    if pattern.lower() in line.lower():
                        skip_line = True
                        break
            
            if skip_line:
                continue
            
            # Check footer patterns
            for pattern in strip_rules.footer_patterns:
                try:
                    if re.search(pattern, line.strip(), re.IGNORECASE):
                        skip_line = True
                        break
                except re.error:
                    if pattern.lower() in line.lower():
                        skip_line = True
                        break
            
            if skip_line:
                continue
            
            processed_lines.append(line)
        
        # Join processed lines
        result = '\n'.join(processed_lines)
        
        # Remove mentions if configured
        if strip_rules.remove_mentions:
            result = re.sub(r'@\w+', '', result)
        
        # Clean up extra whitespace
        result = re.sub(r'\n\s*\n', '\n\n', result)  # Remove lines with only whitespace
        result = result.strip()
        
        return result
    
    @staticmethod
    def preserve_formatting(text: str) -> str:
        """Preserve Markdown/HTML formatting in text"""
        # This is a placeholder - in practice, Telethon handles formatting preservation
        # when forwarding messages with parse_mode parameter
        return text

class MultiSessionCopier:
    """Main copier class supporting multiple users and sessions"""
    
    def __init__(self, config_file: str = "user_copies.json", api_id: int = None, api_hash: str = None):
        self.config_file = Path(config_file)
        self.api_id = api_id
        self.api_hash = api_hash
        self.users: List[UserConfig] = []
        self.clients: Dict[str, TelegramClient] = {}
        self.trap_detector = TrapDetector()
        self.message_processor = MessageProcessor()
        self.paused_users: Set[str] = set()
        self.message_mappings: Dict[str, Dict] = {}
        self.running = False
        
        # Load configurations
        self.load_user_configs()
        self.load_paused_users()
        self.load_message_mappings()
    
    def load_user_configs(self):
        """Load user configurations from JSON file"""
        try:
            if not self.config_file.exists():
                logger.warning(f"Config file {self.config_file} not found, creating default")
                self.create_default_config()
                return
            
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.users = [UserConfig.from_dict(user) for user in data.get('users', [])]
                logger.info(f"Loaded {len(self.users)} user configurations")
        except Exception as e:
            logger.error(f"Failed to load user configs: {e}")
            self.users = []
    
    def create_default_config(self):
        """Create default configuration file"""
        default_config = {
            "users": [
                {
                    "user_id": "example_user",
                    "session_file": "example_user.session",
                    "pairs": [
                        {
                            "source": "@source_channel",
                            "destination": "@dest_channel",
                            "strip_rules": {
                                "remove_mentions": True,
                                "header_patterns": ["^#\\w+", "^(⭐|🔥|VIP|ENTRY)\\b"],
                                "footer_patterns": ["shared by .*", "auto copy.*"]
                            }
                        }
                    ]
                }
            ]
        }
        
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
        logger.info(f"Created default config at {self.config_file}")
    
    def load_paused_users(self):
        """Load paused users from file"""
        paused_file = Path("paused_users.json")
        try:
            if paused_file.exists():
                with open(paused_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.paused_users = set(data.get('paused_users', []))
                    logger.info(f"Loaded {len(self.paused_users)} paused users")
        except Exception as e:
            logger.error(f"Failed to load paused users: {e}")
    
    def load_message_mappings(self):
        """Load message ID mappings for edit/delete sync"""
        mappings_file = Path("message_mappings.json")
        try:
            if mappings_file.exists():
                with open(mappings_file, 'r', encoding='utf-8') as f:
                    self.message_mappings = json.load(f)
                    logger.info(f"Loaded message mappings")
        except Exception as e:
            logger.error(f"Failed to load message mappings: {e}")
            self.message_mappings = {}
    
    def save_message_mappings(self):
        """Save message ID mappings to file"""
        try:
            with open("message_mappings.json", 'w', encoding='utf-8') as f:
                json.dump(self.message_mappings, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save message mappings: {e}")
    
    async def initialize_clients(self):
        """Initialize Telegram clients for all users"""
        if not self.api_id or not self.api_hash:
            logger.error("API ID and API Hash must be provided")
            return False
        
        for user in self.users:
            if user.user_id in self.paused_users:
                logger.info(f"Skipping paused user: {user.user_id}")
                continue
            
            try:
                session_path = Path("sessions") / user.session_file
                client = TelegramClient(str(session_path), self.api_id, self.api_hash)
                
                await client.start()
                
                if await client.is_user_authorized():
                    self.clients[user.user_id] = client
                    logger.info(f"Initialized client for user: {user.user_id}")
                    
                    # Setup event handlers for this user
                    await self.setup_event_handlers(client, user)
                else:
                    logger.error(f"User {user.user_id} not authorized")
                    await client.disconnect()
                    
            except Exception as e:
                logger.error(f"Failed to initialize client for {user.user_id}: {e}")
        
        return len(self.clients) > 0
    
    async def setup_event_handlers(self, client: TelegramClient, user: UserConfig):
        """Setup message event handlers for a user's client"""
        # Get source channels for this user
        source_channels = [pair.source for pair in user.pairs]
        
        @client.on(events.NewMessage(chats=source_channels))
        async def handle_new_message(event):
            await self.process_new_message(event, user)
        
        @client.on(events.MessageEdited(chats=source_channels))
        async def handle_edited_message(event):
            await self.process_edited_message(event, user)
        
        @client.on(events.MessageDeleted)
        async def handle_deleted_message(event):
            await self.process_deleted_message(event, user)
    
    @retry_async(max_attempts=3, base_delay=1.0)
    async def process_new_message(self, event, user: UserConfig):
        """Process new incoming message"""
        try:
            message = event.message
            source_chat = await event.get_chat()
            source_channel = f"@{source_chat.username}" if source_chat.username else str(source_chat.id)
            
            # Find matching pair
            pair = None
            for p in user.pairs:
                if p.source == source_channel or p.source == str(source_chat.id):
                    pair = p
                    break
            
            if not pair:
                return
            
            # Check for text traps
            if message.text and self.trap_detector.is_text_trap(message.text):
                logger.warning(f"Blocked text trap from {source_channel}")
                return
            
            # Check for image traps
            if message.photo or message.document:
                try:
                    media_bytes = await message.download_media(bytes)
                    if self.trap_detector.is_image_trap(media_bytes):
                        logger.warning(f"Blocked image trap from {source_channel}")
                        return
                except Exception as e:
                    logger.error(f"Failed to check image trap: {e}")
            
            # Process message content
            processed_text = message.text or ""
            if processed_text:
                processed_text = self.message_processor.strip_custom_header_footer(
                    processed_text, pair.strip_rules
                )
                
                # Skip if message becomes empty after processing
                if not processed_text.strip() and not (message.photo or message.document):
                    return
            
            # Forward message
            await self.forward_message(message, pair, user, processed_text)
            
        except FloodWaitError as e:
            logger.warning(f"Flood wait error: {e.seconds} seconds")
            await asyncio.sleep(e.seconds)
            raise  # Will be retried by decorator
        except Exception as e:
            logger.error(f"Error processing new message: {e}")
    
    async def forward_message(self, original_message, pair: CopyPair, user: UserConfig, processed_text: str):
        """Forward message to destination channel"""
        try:
            client = self.clients[user.user_id]
            
            # Get destination channel
            dest_entity = await client.get_entity(pair.destination)
            
            sent_message = None
            
            if original_message.photo:
                # Forward photo with processed caption
                sent_message = await client.send_file(
                    dest_entity,
                    original_message.photo,
                    caption=processed_text if processed_text else None,
                    parse_mode='html'
                )
            elif original_message.document:
                # Forward document with processed caption
                sent_message = await client.send_file(
                    dest_entity,
                    original_message.document,
                    caption=processed_text if processed_text else None,
                    parse_mode='html'
                )
            elif processed_text:
                # Send text message
                sent_message = await client.send_message(
                    dest_entity,
                    processed_text,
                    parse_mode='html'
                )
            
            if sent_message:
                # Store message mapping for edit/delete sync
                mapping_key = f"{user.user_id}_{original_message.id}"
                self.message_mappings[mapping_key] = {
                    "original_id": original_message.id,
                    "sent_id": sent_message.id,
                    "user_id": user.user_id,
                    "source": pair.source,
                    "destination": pair.destination,
                    "timestamp": datetime.now().isoformat()
                }
                self.save_message_mappings()
                
                logger.info(f"Forwarded message from {pair.source} to {pair.destination}")
        
        except Exception as e:
            logger.error(f"Failed to forward message: {e}")
    
    async def process_edited_message(self, event, user: UserConfig):
        """Process edited message and sync to destination"""
        try:
            # Check for edit trap
            if self.trap_detector.is_edit_trap(event.message.id):
                logger.warning(f"Edit trap detected for message {event.message.id}")
                return
            
            mapping_key = f"{user.user_id}_{event.message.id}"
            if mapping_key not in self.message_mappings:
                return
            
            mapping = self.message_mappings[mapping_key]
            client = self.clients[user.user_id]
            
            # Find the pair configuration
            pair = None
            for p in user.pairs:
                if p.source == mapping["source"]:
                    pair = p
                    break
            
            if not pair:
                return
            
            # Process edited content
            processed_text = event.message.text or ""
            if processed_text:
                processed_text = self.message_processor.strip_custom_header_footer(
                    processed_text, pair.strip_rules
                )
            
            # Edit the forwarded message
            dest_entity = await client.get_entity(mapping["destination"])
            await client.edit_message(
                dest_entity,
                mapping["sent_id"],
                processed_text,
                parse_mode='html'
            )
            
            logger.info(f"Synced message edit from {mapping['source']} to {mapping['destination']}")
            
        except Exception as e:
            logger.error(f"Failed to process edited message: {e}")
    
    async def process_deleted_message(self, event, user: UserConfig):
        """Process deleted message and sync to destination"""
        try:
            for deleted_id in event.deleted_ids:
                mapping_key = f"{user.user_id}_{deleted_id}"
                if mapping_key not in self.message_mappings:
                    continue
                
                mapping = self.message_mappings[mapping_key]
                client = self.clients[user.user_id]
                
                # Delete the forwarded message
                dest_entity = await client.get_entity(mapping["destination"])
                await client.delete_messages(dest_entity, [mapping["sent_id"]])
                
                # Remove from mappings
                del self.message_mappings[mapping_key]
                self.save_message_mappings()
                
                logger.info(f"Synced message deletion from {mapping['source']} to {mapping['destination']}")
                
        except Exception as e:
            logger.error(f"Failed to process deleted message: {e}")
    
    async def start(self):
        """Start the multi-session copier"""
        if self.running:
            logger.warning("Copier is already running")
            return
        
        logger.info("Starting multi-session Telegram copier...")
        
        if not await self.initialize_clients():
            logger.error("Failed to initialize any clients")
            return False
        
        self.running = True
        logger.info(f"Copier started with {len(self.clients)} active sessions")
        
        try:
            # Keep the clients running
            while self.running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        finally:
            await self.stop()
        
        return True
    
    async def stop(self):
        """Stop the multi-session copier"""
        if not self.running:
            return
        
        logger.info("Stopping multi-session Telegram copier...")
        self.running = False
        
        # Disconnect all clients
        for user_id, client in self.clients.items():
            try:
                await client.disconnect()
                logger.info(f"Disconnected client for user: {user_id}")
            except Exception as e:
                logger.error(f"Error disconnecting client for {user_id}: {e}")
        
        self.clients.clear()
        logger.info("Multi-session copier stopped")

# Main execution function
async def main():
    """Main entry point for the copier"""
    import os
    
    # Get API credentials from environment
    api_id = os.getenv('TELEGRAM_API_ID')
    api_hash = os.getenv('TELEGRAM_API_HASH')
    
    if not api_id or not api_hash:
        logger.error("TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables required")
        return
    
    try:
        api_id = int(api_id)
    except ValueError:
        logger.error("TELEGRAM_API_ID must be an integer")
        return
    
    # Create and start copier
    copier = MultiSessionCopier(api_id=api_id, api_hash=api_hash)
    await copier.start()

if __name__ == "__main__":
    asyncio.run(main())