#!/usr/bin/env python3
"""
Standalone Discord Bot for AutoForwardX (Development Mode)
Provides message cleaning functionality without Discord.py dependencies
"""

import asyncio
import json
import logging
import os
import sys
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime

# Import our message cleaner
from discord_bot import MessageCleaner

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/discord_bot_standalone.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class StandaloneDiscordBot:
    """Standalone Discord bot for development and testing"""
    
    def __init__(self):
        self.message_cleaner = MessageCleaner()
        self.config_file = Path('telegram_reader/config/pairs.json')
        self.load_config()
        logger.info("Standalone Discord bot initialized")
    
    def load_config(self):
        """Load pairs configuration"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    self.pairs = json.load(f)
                logger.info(f"Loaded {len(self.pairs)} pairs")
            else:
                logger.warning(f"Config file {self.config_file} not found")
                self.pairs = []
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            self.pairs = []
    
    async def process_message(self, message_content: str, message_id: str = None) -> Dict[str, Any]:
        """Process a message through the cleaning pipeline"""
        try:
            # Use the message cleaner
            cleaned_content, is_trap = self.message_cleaner.clean_discord_message(
                message_content, message_id
            )
            
            result = {
                'original': message_content,
                'cleaned': cleaned_content,
                'is_trap': is_trap,
                'message_id': message_id,
                'timestamp': datetime.now().isoformat()
            }
            
            if is_trap:
                logger.warning(f"Trap detected in message {message_id}")
            else:
                logger.info(f"Message {message_id} cleaned successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                'original': message_content,
                'cleaned': message_content,
                'is_trap': False,
                'error': str(e),
                'message_id': message_id
            }
    
    async def run(self):
        """Run the standalone bot"""
        logger.info("Standalone Discord bot started")
        
        # Test the message cleaner with sample messages
        test_messages = [
            "This is a normal trading signal",
            "***VIP SIGNAL***\nBuy BTCUSDT at 45000",
            "🔥🔥🔥🔥🔥 Amazing signal!!!",
            "/ *",
            "Hey @everyone check this out!"
        ]
        
        for i, msg in enumerate(test_messages):
            result = await self.process_message(msg, f"test_{i}")
            logger.info(f"Test result: {result}")
            await asyncio.sleep(1)
        
        # Keep running
        while True:
            try:
                await asyncio.sleep(30)
                logger.info("Discord bot is running...")
                
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Error in bot loop: {e}")
                await asyncio.sleep(5)

async def main():
    """Main entry point"""
    # Create necessary directories
    for directory in ['logs', 'telegram_reader/config']:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    # Start the bot
    bot = StandaloneDiscordBot()
    await bot.run()

if __name__ == "__main__":
    asyncio.run(main())