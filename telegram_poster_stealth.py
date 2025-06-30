#!/usr/bin/env python3
"""
AutoForwardX Stealth-Enhanced Telegram Poster
Advanced message posting with 100/100 stealth capabilities
Ensures complete anonymity and anti-fingerprinting
"""

import asyncio
import json
import logging
import os
import sys
from typing import Dict, List, Optional, Any, Tuple, Union
from pathlib import Path
from datetime import datetime
import hashlib

# Import stealth engine for complete message processing
from stealth_engine import StealthEngine, process_for_telegram, verify_message_stealth

# Telegram posting imports
try:
    from pyrogram import Client, errors as pyrogram_errors
    from pyrogram.types import Message
    PYROGRAM_AVAILABLE = True
except ImportError:
    PYROGRAM_AVAILABLE = False
    print("Pyrogram not available - running in development mode")

# Setup stealth logging
stealth_logger = logging.getLogger('telegram_poster_stealth')
stealth_handler = logging.FileHandler('logs/stealth_audit.log')
stealth_handler.setFormatter(logging.Formatter('%(asctime)s - STEALTH_POSTER - %(levelname)s - %(message)s'))
stealth_logger.addHandler(stealth_handler)
stealth_logger.setLevel(logging.INFO)

class StealthTelegramPoster:
    """Enhanced Telegram poster with complete stealth capabilities"""
    
    def __init__(self, config_file: str = "telegram_poster_config.json"):
        self.config_file = Path(config_file)
        self.config = self._load_config()
        self.stealth_engine = StealthEngine()
        self.message_mappings = {}
        self.clients = {}
        
        stealth_logger.info("Stealth Telegram Poster initialized")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load poster configuration"""
        default_config = {
            "stealth_settings": {
                "verify_before_send": True,
                "min_compliance_score": 85,
                "enable_watermark": False,
                "enable_ai_rewrite": False,
                "strip_all_attribution": True
            },
            "posting_settings": {
                "parse_mode": "HTML",
                "disable_notification": False,
                "protect_content": True,
                "retry_attempts": 3
            },
            "verification_settings": {
                "log_all_posts": True,
                "verify_after_send": True,
                "alert_on_compliance_fail": True
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                stealth_logger.info(f"Loaded config from {self.config_file}")
                return {**default_config, **config}
            except Exception as e:
                stealth_logger.warning(f"Failed to load config: {e}")
        else:
            # Create default config
            with open(self.config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            stealth_logger.info(f"Created default config at {self.config_file}")
        
        return default_config
    
    async def prepare_message_for_posting(self, text: str, image_bytes: bytes = None, 
                                         channel_id: str = None) -> Tuple[str, bytes, Dict[str, Any]]:
        """
        Complete stealth preparation of message for posting
        
        Args:
            text: Original message text
            image_bytes: Optional image data
            channel_id: Target channel ID
            
        Returns:
            Tuple of (stealth_text, stealth_image, compliance_report)
        """
        stealth_logger.info(f"Preparing message for stealth posting to {channel_id}")
        
        # Step 1: Process through complete stealth pipeline
        stealth_text, stealth_image = self.stealth_engine.process_message_complete(
            text, 
            image_bytes, 
            channel_id,
            enable_watermark=self.config["stealth_settings"]["enable_watermark"]
        )
        
        # Step 2: Verify stealth compliance
        compliance = self.stealth_engine.verify_stealth_compliance(stealth_text, stealth_image)
        
        # Step 3: Check compliance threshold
        min_score = self.config["stealth_settings"]["min_compliance_score"]
        if compliance['overall_score'] < min_score:
            stealth_logger.warning(f"Compliance below threshold: {compliance['overall_score']}/{min_score}")
            
            if self.config["verification_settings"]["alert_on_compliance_fail"]:
                stealth_logger.error("Message BLOCKED - Stealth compliance failed")
                return None, None, compliance
        
        stealth_logger.info(f"Message prepared: {compliance['overall_score']}/100 compliance")
        return stealth_text, stealth_image, compliance
    
    async def post_stealth_message(self, bot_token: str, channel_id: str, text: str, 
                                  image_bytes: bytes = None, reply_to_msg_id: int = None) -> Optional[Dict[str, Any]]:
        """
        Post message with complete stealth verification
        
        Args:
            bot_token: Telegram bot token
            channel_id: Target channel ID
            text: Message text
            image_bytes: Optional image
            reply_to_msg_id: Optional reply message ID
            
        Returns:
            Posted message info or None if failed
        """
        if not PYROGRAM_AVAILABLE:
            stealth_logger.error("Pyrogram not available - cannot post")
            return None
        
        try:
            # Step 1: Prepare message with stealth processing
            stealth_text, stealth_image, compliance = await self.prepare_message_for_posting(
                text, image_bytes, channel_id
            )
            
            # Check if message was blocked
            if stealth_text is None:
                stealth_logger.error("Message blocked due to stealth compliance failure")
                return None
            
            # Step 2: Initialize Pyrogram client
            if bot_token not in self.clients:
                session_name = f"stealth_bot_{hashlib.md5(bot_token.encode()).hexdigest()[:8]}"
                self.clients[bot_token] = Client(
                    session_name,
                    bot_token=bot_token,
                    in_memory=True
                )
            
            client = self.clients[bot_token]
            
            # Step 3: Post message using bot (NOT forward_message)
            async with client:
                posted_message = None
                
                if stealth_image:
                    # Post image with stealth caption
                    import io
                    posted_message = await client.send_photo(
                        chat_id=channel_id,
                        photo=io.BytesIO(stealth_image),
                        caption=stealth_text,
                        parse_mode=self.config["posting_settings"]["parse_mode"],
                        disable_notification=self.config["posting_settings"]["disable_notification"],
                        protect_content=self.config["posting_settings"]["protect_content"],
                        reply_to_message_id=reply_to_msg_id
                    )
                else:
                    # Post text message
                    posted_message = await client.send_message(
                        chat_id=channel_id,
                        text=stealth_text,
                        parse_mode=self.config["posting_settings"]["parse_mode"],
                        disable_notification=self.config["posting_settings"]["disable_notification"],
                        protect_content=self.config["posting_settings"]["protect_content"],
                        reply_to_message_id=reply_to_msg_id
                    )
                
                if posted_message:
                    message_info = {
                        'message_id': posted_message.message_id,
                        'chat_id': posted_message.chat.id,
                        'date': posted_message.date,
                        'stealth_compliance': compliance['overall_score'],
                        'original_length': len(text),
                        'stealth_length': len(stealth_text),
                        'has_image': stealth_image is not None
                    }
                    
                    stealth_logger.info(f"Message posted successfully: {message_info['message_id']}")
                    
                    # Step 4: Verify post-send compliance
                    if self.config["verification_settings"]["verify_after_send"]:
                        await self._verify_posted_message(posted_message, compliance)
                    
                    return message_info
                
        except pyrogram_errors.FloodWait as e:
            stealth_logger.warning(f"Flood wait: {e.value} seconds")
            await asyncio.sleep(e.value)
            return None
        except Exception as e:
            stealth_logger.error(f"Failed to post stealth message: {e}")
            return None
        
        return None
    
    async def _verify_posted_message(self, posted_message: Message, original_compliance: Dict[str, Any]):
        """Verify posted message maintains stealth compliance"""
        try:
            # Check the actual posted content
            posted_text = posted_message.text or posted_message.caption or ""
            
            # Verify no attribution metadata was added
            attribution_indicators = [
                'forwarded from',
                'via @',
                'shared by',
                'originally posted',
                'from channel'
            ]
            
            has_attribution = any(indicator in posted_text.lower() for indicator in attribution_indicators)
            
            verification = {
                'message_id': posted_message.message_id,
                'has_attribution': has_attribution,
                'text_length': len(posted_text),
                'original_compliance': original_compliance['overall_score'],
                'verification_passed': not has_attribution
            }
            
            if has_attribution:
                stealth_logger.error(f"STEALTH BREACH: Posted message contains attribution")
            else:
                stealth_logger.info(f"Stealth verification passed: {posted_message.message_id}")
            
            # Log verification result
            stealth_logger.info(f"Post-send verification: {verification}")
            
        except Exception as e:
            stealth_logger.error(f"Post-send verification failed: {e}")
    
    async def edit_stealth_message(self, bot_token: str, channel_id: str, message_id: int, 
                                  new_text: str) -> bool:
        """Edit message with stealth processing"""
        try:
            # Process new text through stealth pipeline
            stealth_text, _, compliance = await self.prepare_message_for_posting(new_text, None, channel_id)
            
            if stealth_text is None:
                stealth_logger.error("Edit blocked due to stealth compliance failure")
                return False
            
            client = self.clients.get(bot_token)
            if not client:
                stealth_logger.error("Client not available for edit operation")
                return False
            
            async with client:
                await client.edit_message_text(
                    chat_id=channel_id,
                    message_id=message_id,
                    text=stealth_text,
                    parse_mode=self.config["posting_settings"]["parse_mode"]
                )
            
            stealth_logger.info(f"Message edited with stealth: {message_id}")
            return True
            
        except Exception as e:
            stealth_logger.error(f"Failed to edit stealth message: {e}")
            return False
    
    async def delete_stealth_message(self, bot_token: str, channel_id: str, message_id: int) -> bool:
        """Delete message (stealth operation)"""
        try:
            client = self.clients.get(bot_token)
            if not client:
                stealth_logger.error("Client not available for delete operation")
                return False
            
            async with client:
                await client.delete_messages(
                    chat_id=channel_id,
                    message_ids=message_id
                )
            
            stealth_logger.info(f"Message deleted: {message_id}")
            return True
            
        except Exception as e:
            stealth_logger.error(f"Failed to delete message: {e}")
            return False
    
    def generate_stealth_report(self) -> Dict[str, Any]:
        """Generate stealth operation report"""
        return {
            'timestamp': datetime.now().isoformat(),
            'stealth_engine_active': True,
            'compliance_threshold': self.config["stealth_settings"]["min_compliance_score"],
            'posting_mode': 'bot_send_only',
            'attribution_stripping': self.config["stealth_settings"]["strip_all_attribution"],
            'verification_enabled': self.config["verification_settings"]["verify_after_send"]
        }

# Convenience functions for integration
async def post_stealth_message(bot_token: str, channel_id: str, text: str, 
                              image_bytes: bytes = None) -> Optional[Dict[str, Any]]:
    """Post message with complete stealth processing"""
    poster = StealthTelegramPoster()
    return await poster.post_stealth_message(bot_token, channel_id, text, image_bytes)

async def verify_posting_stealth(text: str, image_bytes: bytes = None) -> Dict[str, Any]:
    """Verify message stealth before posting"""
    engine = StealthEngine()
    return engine.verify_stealth_compliance(text, image_bytes)

# Initialize default poster
default_poster = StealthTelegramPoster()

# Main entry point for testing
async def main():
    """Test stealth posting capabilities"""
    print("AutoForwardX Stealth Telegram Poster")
    print("="*50)
    
    # Test message preparation
    test_messages = [
        "Buy BTCUSDT at 45000\nTarget: 46000\nStop: 44000",
        "🔥🔥🔥 VIP SIGNAL 🔥🔥🔥\nAMAZING ENTRY!!!\nShared by @tradingbot",
        "*** PREMIUM ALERT ***\nETHUSDT breakout imminent\nGuaranteed profit!"
    ]
    
    poster = StealthTelegramPoster()
    
    for i, msg in enumerate(test_messages):
        print(f"\nTest {i+1}: {msg[:30]}...")
        
        stealth_text, _, compliance = await poster.prepare_message_for_posting(msg)
        
        if stealth_text:
            print(f"✅ Stealth processed: {compliance['overall_score']}/100")
            print(f"Original: {len(msg)} chars → Stealth: {len(stealth_text)} chars")
        else:
            print(f"❌ Blocked: {compliance['overall_score']}/100")
    
    print(f"\n📊 Stealth Report:")
    report = poster.generate_stealth_report()
    for key, value in report.items():
        print(f"  {key}: {value}")

if __name__ == "__main__":
    asyncio.run(main())