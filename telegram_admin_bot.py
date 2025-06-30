"""
AutoForwardX Telegram Admin Bot
Provides inline controls for managing pairs, blocklists, and system operations
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

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
import aiohttp
import aiofiles

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/admin_bot.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class AdminBotConfig:
    """Manage admin bot configuration and state"""
    
    def __init__(self):
        self.config_dir = Path('telegram_reader/config')
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self.pairs_file = self.config_dir / 'pairs.json'
        self.blocklist_file = self.config_dir / 'blocklist.json'
        self.sessions_file = self.config_dir / 'sessions.json'
        
        # Initialize files if they don't exist
        self._init_config_files()
    
    def _init_config_files(self):
        """Initialize configuration files with defaults"""
        if not self.pairs_file.exists():
            default_pairs = [
                {
                    "pair_name": "Demo_Pair",
                    "source_channel": "@demo_source",
                    "discord_webhook": "https://discord.com/api/webhooks/demo",
                    "destination_channel": "@demo_dest",
                    "bot_token": "TELEGRAM_BOT_TOKEN_HERE",
                    "session": "demo_session",
                    "status": "paused",
                    "enable_ai": False
                }
            ]
            self._save_json(self.pairs_file, default_pairs)
        
        if not self.blocklist_file.exists():
            default_blocklist = {
                "global_blocklist": {
                    "text": ["trap", "/ *", "leak", "1", "copy warning"],
                    "images": []
                },
                "pair_blocklist": {}
            }
            self._save_json(self.blocklist_file, default_blocklist)
        
        if not self.sessions_file.exists():
            default_sessions = {
                "demo_session": {
                    "phone": "+1234567890",
                    "session_file": "demo_session.session",
                    "status": "inactive"
                }
            }
            self._save_json(self.sessions_file, default_sessions)
    
    def _load_json(self, file_path: Path) -> dict:
        """Load JSON file with error handling"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return {}
    
    def _save_json(self, file_path: Path, data: dict):
        """Save data to JSON file"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving {file_path}: {e}")
    
    def get_pairs(self) -> List[Dict]:
        """Get all pairs"""
        pairs_data = self._load_json(self.pairs_file)
        return pairs_data if isinstance(pairs_data, list) else []
    
    def update_pair_status(self, pair_name: str, status: str) -> bool:
        """Update pair status"""
        pairs = self.get_pairs()
        for pair in pairs:
            if pair.get('pair_name') == pair_name:
                pair['status'] = status
                self._save_json(self.pairs_file, pairs)
                return True
        return False
    
    def pause_all_pairs(self) -> int:
        """Pause all pairs and return count"""
        pairs = self.get_pairs()
        count = 0
        for pair in pairs:
            if pair.get('status') == 'active':
                pair['status'] = 'paused'
                count += 1
        self._save_json(self.pairs_file, pairs)
        return count
    
    def resume_all_pairs(self) -> int:
        """Resume all pairs and return count"""
        pairs = self.get_pairs()
        count = 0
        for pair in pairs:
            if pair.get('status') == 'paused':
                pair['status'] = 'active'
                count += 1
        self._save_json(self.pairs_file, pairs)
        return count
    
    def add_blocked_text(self, text: str, pair_name: Optional[str] = None) -> bool:
        """Add text to blocklist"""
        blocklist_data = self._load_json(self.blocklist_file)
        
        if pair_name:
            # Add to pair-specific blocklist
            if pair_name not in blocklist_data.get('pair_blocklist', {}):
                blocklist_data.setdefault('pair_blocklist', {})[pair_name] = {'text': [], 'images': []}
            if text not in blocklist_data['pair_blocklist'][pair_name]['text']:
                blocklist_data['pair_blocklist'][pair_name]['text'].append(text)
        else:
            # Add to global blocklist
            if text not in blocklist_data.get('global_blocklist', {}).get('text', []):
                blocklist_data.setdefault('global_blocklist', {}).setdefault('text', []).append(text)
        
        self._save_json(self.blocklist_file, blocklist_data)
        return True
    
    def add_blocked_image(self, image_hash: str, pair_name: Optional[str] = None) -> bool:
        """Add image hash to blocklist"""
        blocklist_data = self._load_json(self.blocklist_file)
        
        if pair_name:
            # Add to pair-specific blocklist
            if pair_name not in blocklist_data.get('pair_blocklist', {}):
                blocklist_data.setdefault('pair_blocklist', {})[pair_name] = {'text': [], 'images': []}
            if image_hash not in blocklist_data['pair_blocklist'][pair_name]['images']:
                blocklist_data['pair_blocklist'][pair_name]['images'].append(image_hash)
        else:
            # Add to global blocklist
            if image_hash not in blocklist_data.get('global_blocklist', {}).get('images', []):
                blocklist_data.setdefault('global_blocklist', {}).setdefault('images', []).append(image_hash)
        
        self._save_json(self.blocklist_file, blocklist_data)
        return True
    
    def get_blocklist_summary(self) -> Dict[str, Any]:
        """Get blocklist summary"""
        blocklist_data = self._load_json(self.blocklist_file)
        
        global_text = len(blocklist_data.get('global_blocklist', {}).get('text', []))
        global_images = len(blocklist_data.get('global_blocklist', {}).get('images', []))
        
        pair_count = len(blocklist_data.get('pair_blocklist', {}))
        
        return {
            'global_text': global_text,
            'global_images': global_images,
            'pair_specific_count': pair_count
        }

class AutoForwardXAdminBot:
    """Main admin bot class"""
    
    def __init__(self):
        self.config = AdminBotConfig()
        self.authorized_users = set()
        self.load_authorized_users()
    
    def load_authorized_users(self):
        """Load authorized user IDs from environment or config"""
        admin_users = os.getenv('ADMIN_USER_IDS', '')
        if admin_users:
            self.authorized_users = set(int(uid.strip()) for uid in admin_users.split(',') if uid.strip())
        logger.info(f"Loaded {len(self.authorized_users)} authorized admin users")
    
    def is_authorized(self, user_id: int) -> bool:
        """Check if user is authorized to use admin commands"""
        return user_id in self.authorized_users
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        user = update.effective_user
        if not self.is_authorized(user.id):
            await update.message.reply_text("Unauthorized access. Contact system administrator.")
            return
        
        welcome_text = (
            "🤖 AutoForwardX Admin Bot\n\n"
            "Welcome to the control panel! Use the buttons below to manage your forwarding system.\n\n"
            "Available commands:\n"
            "/status - System overview\n"
            "/pairs - Manage pairs\n"
            "/blocklist - View blocklist\n"
            "/help - Show help"
        )
        
        keyboard = [
            [InlineKeyboardButton("📊 System Status", callback_data="status")],
            [InlineKeyboardButton("🔗 Manage Pairs", callback_data="pairs_menu")],
            [InlineKeyboardButton("🚫 Blocklist", callback_data="blocklist_menu")],
            [InlineKeyboardButton("❓ Help", callback_data="help")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(welcome_text, reply_markup=reply_markup)
    
    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        pairs = self.config.get_pairs()
        active_pairs = sum(1 for pair in pairs if pair.get('status') == 'active')
        paused_pairs = sum(1 for pair in pairs if pair.get('status') == 'paused')
        
        blocklist_summary = self.config.get_blocklist_summary()
        
        status_text = (
            f"📊 AutoForwardX System Status\n\n"
            f"🔗 Pairs:\n"
            f"   • Active: {active_pairs}\n"
            f"   • Paused: {paused_pairs}\n"
            f"   • Total: {len(pairs)}\n\n"
            f"🚫 Blocklist:\n"
            f"   • Global text rules: {blocklist_summary['global_text']}\n"
            f"   • Global image hashes: {blocklist_summary['global_images']}\n"
            f"   • Pair-specific rules: {blocklist_summary['pair_specific_count']}\n\n"
            f"🕐 Last updated: {datetime.now().strftime('%H:%M:%S')}"
        )
        
        keyboard = [
            [InlineKeyboardButton("🔄 Refresh", callback_data="status")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(status_text, reply_markup=reply_markup)
    
    async def pairs_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /pairs command"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        await self.show_pairs_menu(update, context)
    
    async def show_pairs_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show pairs management menu"""
        pairs = self.config.get_pairs()
        
        if not pairs:
            text = "No pairs configured. Add pairs through the web dashboard."
            keyboard = [[InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]]
        else:
            text = "🔗 Pair Management\n\nSelect a pair to manage or use global controls:"
            
            keyboard = []
            
            # Add individual pair controls
            for pair in pairs[:5]:  # Limit to 5 pairs for space
                name = pair.get('pair_name', 'Unknown')
                status = pair.get('status', 'unknown')
                status_emoji = "✅" if status == "active" else "⏸️" if status == "paused" else "❓"
                keyboard.append([InlineKeyboardButton(
                    f"{status_emoji} {name}", 
                    callback_data=f"pair_{name}"
                )])
            
            # Add global controls
            keyboard.extend([
                [
                    InlineKeyboardButton("⏸️ Pause All", callback_data="pause_all"),
                    InlineKeyboardButton("▶️ Resume All", callback_data="resume_all")
                ],
                [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
            ])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        if update.callback_query:
            await update.callback_query.edit_message_text(text, reply_markup=reply_markup)
        else:
            await update.message.reply_text(text, reply_markup=reply_markup)
    
    async def show_pair_details(self, update: Update, context: ContextTypes.DEFAULT_TYPE, pair_name: str):
        """Show details for a specific pair"""
        pairs = self.config.get_pairs()
        pair = next((p for p in pairs if p.get('pair_name') == pair_name), None)
        
        if not pair:
            await update.callback_query.answer("Pair not found!")
            return
        
        status = pair.get('status', 'unknown')
        status_emoji = "✅" if status == "active" else "⏸️" if status == "paused" else "❓"
        
        text = (
            f"🔗 Pair: {pair_name}\n"
            f"Status: {status_emoji} {status.title()}\n\n"
            f"Source: {pair.get('source_channel', 'N/A')}\n"
            f"Destination: {pair.get('destination_channel', 'N/A')}\n"
            f"Session: {pair.get('session', 'N/A')}\n"
            f"AI Enabled: {'Yes' if pair.get('enable_ai') else 'No'}"
        )
        
        # Create action buttons based on current status
        keyboard = []
        if status == "active":
            keyboard.append([InlineKeyboardButton("⏸️ Pause", callback_data=f"pause_{pair_name}")])
        elif status == "paused":
            keyboard.append([InlineKeyboardButton("▶️ Resume", callback_data=f"resume_{pair_name}")])
        
        keyboard.extend([
            [InlineKeyboardButton("🚫 Add Block Rule", callback_data=f"block_for_{pair_name}")],
            [InlineKeyboardButton("◀️ Back to Pairs", callback_data="pairs_menu")]
        ])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.callback_query.edit_message_text(text, reply_markup=reply_markup)
    
    async def blocklist_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /blocklist command"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        await self.show_blocklist_menu(update, context)
    
    async def show_blocklist_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show blocklist management menu"""
        summary = self.config.get_blocklist_summary()
        
        text = (
            f"🚫 Blocklist Management\n\n"
            f"Global Rules:\n"
            f"   • Text patterns: {summary['global_text']}\n"
            f"   • Image hashes: {summary['global_images']}\n\n"
            f"Pair-specific rules: {summary['pair_specific_count']} pairs\n\n"
            f"Use the buttons below to add new blocking rules."
        )
        
        keyboard = [
            [InlineKeyboardButton("➕ Add Text Block", callback_data="add_text_block")],
            [InlineKeyboardButton("🖼️ Block From Message", callback_data="block_image_help")],
            [InlineKeyboardButton("📋 View Details", callback_data="blocklist_details")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        if update.callback_query:
            await update.callback_query.edit_message_text(text, reply_markup=reply_markup)
        else:
            await update.message.reply_text(text, reply_markup=reply_markup)
    
    async def handle_callback_query(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle inline keyboard callbacks"""
        query = update.callback_query
        await query.answer()
        
        if not self.is_authorized(query.from_user.id):
            await query.edit_message_text("Unauthorized access.")
            return
        
        data = query.data
        
        # Main menu callbacks
        if data == "main_menu":
            await self.start_command(update, context)
        elif data == "status":
            await self.status_command(update, context)
        elif data == "pairs_menu":
            await self.show_pairs_menu(update, context)
        elif data == "blocklist_menu":
            await self.show_blocklist_menu(update, context)
        
        # Pair management callbacks
        elif data == "pause_all":
            count = self.config.pause_all_pairs()
            await query.edit_message_text(
                f"⏸️ Paused {count} pairs\n\nAll active pairs have been paused for safety.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Back to Pairs", callback_data="pairs_menu")
                ]])
            )
        
        elif data == "resume_all":
            count = self.config.resume_all_pairs()
            await query.edit_message_text(
                f"▶️ Resumed {count} pairs\n\nAll paused pairs are now active.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Back to Pairs", callback_data="pairs_menu")
                ]])
            )
        
        elif data.startswith("pair_"):
            pair_name = data[5:]  # Remove "pair_" prefix
            await self.show_pair_details(update, context, pair_name)
        
        elif data.startswith("pause_"):
            pair_name = data[6:]  # Remove "pause_" prefix
            if self.config.update_pair_status(pair_name, "paused"):
                await query.edit_message_text(
                    f"⏸️ Paused pair: {pair_name}\n\nThe pair has been paused and will not forward messages.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("◀️ Back to Pairs", callback_data="pairs_menu")
                    ]])
                )
        
        elif data.startswith("resume_"):
            pair_name = data[7:]  # Remove "resume_" prefix
            if self.config.update_pair_status(pair_name, "active"):
                await query.edit_message_text(
                    f"▶️ Resumed pair: {pair_name}\n\nThe pair is now active and will forward messages.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("◀️ Back to Pairs", callback_data="pairs_menu")
                    ]])
                )
        
        # Blocklist callbacks
        elif data == "add_text_block":
            await query.edit_message_text(
                "🚫 Add Text Block\n\nReply to this message with the text you want to block.\n\nExample: trap",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Back", callback_data="blocklist_menu")
                ]])
            )
            context.user_data['waiting_for_text_block'] = True
        
        elif data == "block_image_help":
            await query.edit_message_text(
                "🖼️ Block Image From Message\n\nTo block an image:\n1. Forward/send the image to this bot\n2. The image hash will be automatically added to the blocklist\n\nThis helps prevent trap images from being forwarded.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Back", callback_data="blocklist_menu")
                ]])
            )
        
        elif data == "help":
            help_text = (
                "❓ AutoForwardX Admin Bot Help\n\n"
                "🔗 Pair Management:\n"
                "   • View all configured pairs\n"
                "   • Pause/resume individual pairs\n"
                "   • Bulk pause/resume all pairs\n\n"
                "🚫 Blocklist Management:\n"
                "   • Add text patterns to block\n"
                "   • Block images by hash\n"
                "   • Global and pair-specific rules\n\n"
                "📊 System Monitoring:\n"
                "   • Real-time status updates\n"
                "   • Activity monitoring\n"
                "   • Trap detection alerts\n\n"
                "For technical support, contact the system administrator."
            )
            await query.edit_message_text(
                help_text,
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")
                ]])
            )
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle text messages"""
        if not self.is_authorized(update.effective_user.id):
            return
        
        # Handle text block input
        if context.user_data.get('waiting_for_text_block'):
            text = update.message.text.strip()
            if text:
                self.config.add_blocked_text(text)
                await update.message.reply_text(
                    f"✅ Added to global blocklist: '{text}'\n\nThis text pattern will now be blocked in all pairs.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("🚫 Blocklist Menu", callback_data="blocklist_menu")
                    ]])
                )
                context.user_data['waiting_for_text_block'] = False
            else:
                await update.message.reply_text("Please provide valid text to block.")
        
        # Handle image blocking
        elif update.message.photo:
            try:
                # Get the largest photo
                photo = update.message.photo[-1]
                file = await context.bot.get_file(photo.file_id)
                
                # Download and hash the image
                file_bytes = await file.download_as_bytearray()
                image_hash = hashlib.md5(file_bytes).hexdigest()
                
                # Add to blocklist
                self.config.add_blocked_image(image_hash)
                
                await update.message.reply_text(
                    f"🖼️ Image blocked successfully!\n\nHash: {image_hash[:16]}...\n\nThis image will now be blocked in all pairs.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("🚫 Blocklist Menu", callback_data="blocklist_menu")
                    ]])
                )
            except Exception as e:
                logger.error(f"Error processing image: {e}")
                await update.message.reply_text("Error processing image. Please try again.")

async def main():
    """Main entry point"""
    # Get bot token
    bot_token = os.getenv('ADMIN_BOT_TOKEN')
    if not bot_token:
        logger.error("ADMIN_BOT_TOKEN environment variable not set")
        sys.exit(1)
    
    # Create necessary directories
    for directory in ['telegram_reader/config', 'logs']:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    # Create bot instance
    admin_bot = AutoForwardXAdminBot()
    
    # Create application
    application = Application.builder().token(bot_token).build()
    
    # Add handlers
    application.add_handler(CommandHandler("start", admin_bot.start_command))
    application.add_handler(CommandHandler("status", admin_bot.status_command))
    application.add_handler(CommandHandler("pairs", admin_bot.pairs_command))
    application.add_handler(CommandHandler("blocklist", admin_bot.blocklist_command))
    application.add_handler(CallbackQueryHandler(admin_bot.handle_callback_query))
    application.add_handler(MessageHandler(filters.TEXT | filters.PHOTO, admin_bot.handle_message))
    
    try:
        logger.info("Starting AutoForwardX Admin Bot...")
        await application.run_polling()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")

if __name__ == "__main__":
    asyncio.run(main())