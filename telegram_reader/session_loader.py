#!/usr/bin/env python3
"""
Session Loader for AutoForwardX
Creates Telegram user sessions using OTP verification
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from datetime import datetime

from telethon import TelegramClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SessionLoader:
    """Handle creation of new Telegram sessions"""
    
    def __init__(self):
        self.api_id = os.getenv('TG_API_ID')
        self.api_hash = os.getenv('TG_API_HASH')
        
        if not self.api_id or not self.api_hash:
            print("Error: TG_API_ID and TG_API_HASH must be set in .env file")
            print("Get these from https://my.telegram.org/apps")
            sys.exit(1)
    
    def load_existing_sessions(self):
        """Load existing sessions from sessions.json"""
        try:
            with open('sessions.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError:
            logger.error("Invalid JSON in sessions.json")
            return {}
    
    def save_sessions(self, sessions_data):
        """Save sessions to sessions.json"""
        with open('sessions.json', 'w') as f:
            json.dump(sessions_data, f, indent=2, default=str)
        logger.info("Sessions saved to sessions.json")
    
    async def create_new_session(self, session_name, phone_number):
        """Create a new Telegram session"""
        session_file = f"{session_name}.session"
        
        # Check if session file already exists
        if Path(session_file).exists():
            overwrite = input(f"Session file {session_file} already exists. Overwrite? (y/N): ")
            if overwrite.lower() != 'y':
                print("Session creation cancelled")
                return None
        
        print(f"\nCreating session: {session_name}")
        print(f"Phone number: {phone_number}")
        print("You will receive an OTP code from Telegram...")
        
        client = TelegramClient(session_name, self.api_id, self.api_hash)
        
        try:
            await client.start(phone=phone_number)
            
            # Verify the session works
            me = await client.get_me()
            print(f"\nSuccess! Session created for {me.first_name} {me.last_name or ''}")
            print(f"Phone: {me.phone}")
            print(f"Username: @{me.username}" if me.username else "Username: Not set")
            
            await client.disconnect()
            
            # Return session configuration
            return {
                'phone': phone_number,
                'session_file': session_file,
                'status': 'active',
                'created_at': datetime.now().isoformat(),
                'last_active': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            print(f"Error: {e}")
            
            # Clean up failed session file
            if Path(session_file).exists():
                Path(session_file).unlink()
            
            return None
    
    def generate_session_name(self, existing_sessions):
        """Generate a unique session name"""
        base_name = "gold_session"
        counter = 1
        
        while f"{base_name}_{counter}" in existing_sessions:
            counter += 1
        
        return f"{base_name}_{counter}"
    
    async def interactive_session_creation(self):
        """Interactive session creation process"""
        print("=== AutoForwardX Session Creator ===")
        print("This tool creates Telegram user sessions for reading private channels")
        print()
        
        # Load existing sessions
        existing_sessions = self.load_existing_sessions()
        
        if existing_sessions:
            print("Existing sessions:")
            for name, config in existing_sessions.items():
                status = config.get('status', 'unknown')
                phone = config.get('phone', 'unknown')
                print(f"  - {name}: {phone} ({status})")
            print()
        
        # Get session details from user
        session_name = input("Enter session name (or press Enter for auto-generated): ").strip()
        if not session_name:
            session_name = self.generate_session_name(existing_sessions)
            print(f"Generated session name: {session_name}")
        
        phone_number = input("Enter phone number (e.g., +91xxxxxxxxxx): ").strip()
        if not phone_number:
            print("Phone number is required")
            return
        
        # Validate phone number format
        if not phone_number.startswith('+'):
            print("Phone number should start with country code (e.g., +91xxxxxxxxxx)")
            return
        
        # Create the session
        session_config = await self.create_new_session(session_name, phone_number)
        
        if session_config:
            # Add to existing sessions
            existing_sessions[session_name] = session_config
            
            # Save updated sessions
            self.save_sessions(existing_sessions)
            
            print(f"\nSession '{session_name}' created successfully!")
            print(f"Session file: {session_config['session_file']}")
            print("\nYou can now use this session in your pairs configuration.")
        else:
            print("Failed to create session")

async def main():
    """Main entry point"""
    loader = SessionLoader()
    await loader.interactive_session_creation()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSession creation cancelled by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)