"""
AutoForwardX Telegram → Telegram Copier Module (Multi-User)
Supports multiple .session files and users with independent pairs
"""

import asyncio
import json
import logging
import hashlib
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from telethon import TelegramClient, events
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument
import aiofiles

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MessageMapping:
    """Track message relationships for edit/delete sync"""
    
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
        except Exception as e:
            logger.error(f"Failed to load mappings: {e}")
            self.mappings = {}
    
    def save_mappings(self):
        """Save message mappings to file"""
        try:
            with open(self.mapping_file, 'w', encoding='utf-8') as f:
                json.dump(self.mappings, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save mappings: {e}")
    
    def add_mapping(self, source_msg_id: str, dest_msg_id: str, user_id: str, pair_name: str):
        """Add a new message mapping"""
        self.mappings[source_msg_id] = {
            "dest_msg_id": dest_msg_id,
            "user_id": user_id,
            "pair_name": pair_name,
            "edit_count": 0
        }
        self.save_mappings()
    
    def get_mapping(self, source_msg_id: str) -> Optional[Dict]:
        """Get mapping for a source message"""
        return self.mappings.get(source_msg_id)
    
    def increment_edit_count(self, source_msg_id: str) -> int:
        """Increment edit count and return new count"""
        if source_msg_id in self.mappings:
            self.mappings[source_msg_id]["edit_count"] += 1
            self.save_mappings()
            return self.mappings[source_msg_id]["edit_count"]
        return 0

class TrapDetector:
    """Detect and handle trap patterns"""
    
    def __init__(self, blocklist_file: str = "blocklist.json"):
        self.blocklist_file = Path(blocklist_file)
        self.blocklist = {
            "global": {
                "text_patterns": [],
                "image_hashes": []
            },
            "pairs": {}
        }
        self.load_blocklist()
    
    def load_blocklist(self):
        """Load blocklist from file"""
        try:
            if self.blocklist_file.exists():
                with open(self.blocklist_file, 'r', encoding='utf-8') as f:
                    self.blocklist = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load blocklist: {e}")
    
    def save_blocklist(self):
        """Save blocklist to file"""
        try:
            with open(self.blocklist_file, 'w', encoding='utf-8') as f:
                json.dump(self.blocklist, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save blocklist: {e}")
    
    def add_text_pattern(self, pattern: str, pair_name: Optional[str] = None):
        """Add text pattern to blocklist"""
        if pair_name:
            if pair_name not in self.blocklist["pairs"]:
                self.blocklist["pairs"][pair_name] = {"text_patterns": [], "image_hashes": []}
            self.blocklist["pairs"][pair_name]["text_patterns"].append(pattern)
        else:
            self.blocklist["global"]["text_patterns"].append(pattern)
        self.save_blocklist()
    
    def add_image_hash(self, image_hash: str, pair_name: Optional[str] = None):
        """Add image hash to blocklist"""
        if pair_name:
            if pair_name not in self.blocklist["pairs"]:
                self.blocklist["pairs"][pair_name] = {"text_patterns": [], "image_hashes": []}
            self.blocklist["pairs"][pair_name]["image_hashes"].append(image_hash)
        else:
            self.blocklist["global"]["image_hashes"].append(image_hash)
        self.save_blocklist()
    
    def is_text_blocked(self, text: str, pair_name: str) -> bool:
        """Check if text contains blocked patterns"""
        text_lower = text.lower()
        
        # Check global patterns
        for pattern in self.blocklist["global"]["text_patterns"]:
            if pattern.lower() in text_lower:
                return True
        
        # Check pair-specific patterns
        pair_blocklist = self.blocklist["pairs"].get(pair_name, {})
        for pattern in pair_blocklist.get("text_patterns", []):
            if pattern.lower() in text_lower:
                return True
        
        return False
    
    def is_image_blocked(self, image_hash: str, pair_name: str) -> bool:
        """Check if image hash is blocked"""
        # Check global hashes
        if image_hash in self.blocklist["global"]["image_hashes"]:
            return True
        
        # Check pair-specific hashes
        pair_blocklist = self.blocklist["pairs"].get(pair_name, {})
        if image_hash in pair_blocklist.get("image_hashes", []):
            return True
        
        return False
    
    def detect_trap_patterns(self, content: str) -> Optional[str]:
        """Detect known trap patterns"""
        content_lower = content.lower().strip()
        
        # Common trap patterns
        trap_patterns = [
            ("edit_bait", ["/ *", "1", "leak", "trap", "edit this"]),
            ("crypto_scam", ["airdrop", "free tokens", "wallet seed"]),
            ("pump_dump", ["moon", "🚀", "buy now", "last chance"])
        ]
        
        for trap_type, patterns in trap_patterns:
            for pattern in patterns:
                if pattern in content_lower:
                    return trap_type
        
        return None

class TelegramCopier:
    """Main copier class for multi-user Telegram → Telegram copying"""
    
    def __init__(self, config_file: str = "user_copies.json"):
        self.config_file = Path(config_file)
        self.users_config = {"users": []}
        self.clients: Dict[str, TelegramClient] = {}
        self.message_mapping = MessageMapping()
        self.trap_detector = TrapDetector()
        self.load_config()
    
    def load_config(self):
        """Load user configurations"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.users_config = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
    
    async def init_sessions(self):
        """Initialize Telegram sessions for all users"""
        for user in self.users_config["users"]:
            user_id = user["user_id"]
            session_file = user["session_file"]
            
            if not Path(session_file).exists():
                logger.warning(f"Session file {session_file} not found for user {user_id}")
                continue
            
            try:
                # Initialize client
                api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
                api_hash = os.getenv("TELEGRAM_API_HASH", "")
                
                if not api_id or not api_hash:
                    logger.error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set")
                    continue
                
                client = TelegramClient(session_file, api_id, api_hash)
                await client.start()
                
                self.clients[user_id] = client
                logger.info(f"Session initialized for user: {user_id}")
                
                # Register message handlers for this user
                await self.register_handlers(client, user)
                
            except Exception as e:
                logger.error(f"Failed to initialize session for {user_id}: {e}")
    
    async def register_handlers(self, client: TelegramClient, user: Dict):
        """Register message handlers for a user"""
        user_id = user["user_id"]
        pairs = user["pairs"]
        
        # Get source channels for this user
        source_channels = [pair["source"] for pair in pairs]
        
        @client.on(events.NewMessage(chats=source_channels))
        async def handle_new_message(event):
            await self.process_message(event, user_id, pairs)
        
        @client.on(events.MessageEdited(chats=source_channels))
        async def handle_edited_message(event):
            await self.process_edit(event, user_id, pairs)
        
        @client.on(events.MessageDeleted)
        async def handle_deleted_message(event):
            await self.process_delete(event, user_id, pairs)
    
    async def process_message(self, event, user_id: str, pairs: List[Dict]):
        """Process new message"""
        try:
            message = event.message
            source_channel = message.chat.username or str(message.chat_id)
            
            # Find matching pair
            for pair in pairs:
                if pair["source"] in [source_channel, f"@{source_channel}"]:
                    destination = pair["destination"]
                    pair_name = f"{user_id}_{pair['source']}_{destination}"
                    
                    # Check for traps
                    if message.text:
                        if self.trap_detector.is_text_blocked(message.text, pair_name):
                            logger.warning(f"Message blocked by text filter: {pair_name}")
                            return
                        
                        trap_type = self.trap_detector.detect_trap_patterns(message.text)
                        if trap_type:
                            logger.warning(f"Trap detected ({trap_type}): {pair_name}")
                            return
                    
                    # Check image hash if present
                    if message.media:
                        image_hash = await self.get_image_hash(message)
                        if image_hash and self.trap_detector.is_image_blocked(image_hash, pair_name):
                            logger.warning(f"Image blocked by hash: {pair_name}")
                            return
                    
                    # Forward message
                    sent_message = await self.forward_message(user_id, message, destination)
                    if sent_message:
                        # Store mapping
                        self.message_mapping.add_mapping(
                            str(message.id), 
                            str(sent_message.id), 
                            user_id, 
                            pair_name
                        )
                        logger.info(f"Message forwarded: {pair_name}")
                    
                    break
                    
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def process_edit(self, event, user_id: str, pairs: List[Dict]):
        """Process message edit"""
        try:
            message = event.message
            source_msg_id = str(message.id)
            
            # Get mapping
            mapping = self.message_mapping.get_mapping(source_msg_id)
            if not mapping or mapping["user_id"] != user_id:
                return
            
            # Increment edit count for trap detection
            edit_count = self.message_mapping.increment_edit_count(source_msg_id)
            if edit_count >= 3:
                logger.warning(f"Edit trap detected: {mapping['pair_name']} (count: {edit_count})")
                return
            
            # Edit destination message
            dest_msg_id = int(mapping["dest_msg_id"])
            client = self.clients.get(user_id)
            if client:
                # Find destination channel
                for pair in pairs:
                    pair_name = f"{user_id}_{pair['source']}_{pair['destination']}"
                    if pair_name == mapping["pair_name"]:
                        await client.edit_message(pair["destination"], dest_msg_id, message.text)
                        logger.info(f"Message edited: {pair_name}")
                        break
                        
        except Exception as e:
            logger.error(f"Error processing edit: {e}")
    
    async def process_delete(self, event, user_id: str, pairs: List[Dict]):
        """Process message deletion"""
        try:
            for deleted_id in event.deleted_ids:
                source_msg_id = str(deleted_id)
                mapping = self.message_mapping.get_mapping(source_msg_id)
                
                if mapping and mapping["user_id"] == user_id:
                    dest_msg_id = int(mapping["dest_msg_id"])
                    client = self.clients.get(user_id)
                    if client:
                        # Find destination channel
                        for pair in pairs:
                            pair_name = f"{user_id}_{pair['source']}_{pair['destination']}"
                            if pair_name == mapping["pair_name"]:
                                await client.delete_messages(pair["destination"], [dest_msg_id])
                                logger.info(f"Message deleted: {pair_name}")
                                break
                                
        except Exception as e:
            logger.error(f"Error processing delete: {e}")
    
    async def forward_message(self, user_id: str, message, destination: str):
        """Forward message to destination"""
        try:
            client = self.clients.get(user_id)
            if not client:
                return None
            
            # Forward the message
            sent_message = await client.forward_messages(destination, message)
            return sent_message[0] if sent_message else None
            
        except Exception as e:
            logger.error(f"Error forwarding message: {e}")
            return None
    
    async def get_image_hash(self, message) -> Optional[str]:
        """Get hash of image for trap detection"""
        try:
            if not message.media:
                return None
            
            if isinstance(message.media, (MessageMediaPhoto, MessageMediaDocument)):
                # Download file to memory and hash it
                file_bytes = await message.download_media(bytes)
                if file_bytes:
                    return hashlib.md5(file_bytes).hexdigest()
            
        except Exception as e:
            logger.error(f"Error hashing image: {e}")
        
        return None
    
    async def start(self):
        """Start the copier"""
        logger.info("Starting Telegram Copier...")
        await self.init_sessions()
        
        if not self.clients:
            logger.error("No valid sessions found")
            return
        
        logger.info(f"Copier started with {len(self.clients)} active sessions")
        
        # Keep running
        try:
            await asyncio.Event().wait()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop all clients"""
        for user_id, client in self.clients.items():
            try:
                await client.disconnect()
                logger.info(f"Disconnected session: {user_id}")
            except Exception as e:
                logger.error(f"Error disconnecting {user_id}: {e}")

async def main():
    """Main entry point"""
    copier = TelegramCopier()
    await copier.start()

if __name__ == "__main__":
    asyncio.run(main())