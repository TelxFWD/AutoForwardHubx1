"""
Telethon Session Loader for AutoForwardX
Creates and manages Telegram user sessions via phone number and OTP
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError, PhoneNumberInvalidError
import json

class SessionLoader:
    """Handle Telethon session creation and management"""
    
    def __init__(self):
        # Get credentials from environment
        self.api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
        self.api_hash = os.getenv("TELEGRAM_API_HASH", "")
        
        if not self.api_id or not self.api_hash:
            raise ValueError("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set")
        
        # Ensure sessions directory exists
        self.sessions_dir = Path("sessions")
        self.sessions_dir.mkdir(exist_ok=True)
    
    async def create_session(self, phone_number: str, session_name: str = None) -> str:
        """Create a new Telegram session"""
        if not session_name:
            # Generate session name from phone number
            clean_phone = phone_number.replace("+", "").replace("-", "").replace(" ", "")
            session_name = f"user_{clean_phone}"
        
        session_file = self.sessions_dir / f"{session_name}.session"
        
        try:
            client = TelegramClient(str(session_file), self.api_id, self.api_hash)
            await client.start(phone=phone_number)
            
            # Check if user is logged in
            if await client.is_user_authorized():
                user = await client.get_me()
                await client.disconnect()
                
                # Save session metadata
                await self.save_session_metadata(session_name, phone_number, user)
                
                return f"Session created successfully for {user.first_name} ({phone_number})"
            else:
                await client.disconnect()
                return "Failed to authorize user"
                
        except PhoneNumberInvalidError:
            return "Invalid phone number format"
        except SessionPasswordNeededError:
            await client.disconnect()
            return "Two-step verification enabled. Please disable it temporarily."
        except Exception as e:
            return f"Error creating session: {str(e)}"
    
    async def verify_otp(self, phone_number: str, otp_code: str, session_name: str = None) -> str:
        """Verify OTP for session creation"""
        if not session_name:
            clean_phone = phone_number.replace("+", "").replace("-", "").replace(" ", "")
            session_name = f"user_{clean_phone}"
        
        session_file = self.sessions_dir / f"{session_name}.session"
        
        try:
            client = TelegramClient(str(session_file), self.api_id, self.api_hash)
            await client.start(phone=phone_number, code=otp_code)
            
            if await client.is_user_authorized():
                user = await client.get_me()
                await client.disconnect()
                
                # Save session metadata
                await self.save_session_metadata(session_name, phone_number, user)
                
                return f"OTP verified successfully for {user.first_name}"
            else:
                await client.disconnect()
                return "OTP verification failed"
                
        except Exception as e:
            return f"Error verifying OTP: {str(e)}"
    
    async def save_session_metadata(self, session_name: str, phone_number: str, user):
        """Save session metadata to JSON file"""
        metadata = {
            "session_name": session_name,
            "phone_number": phone_number,
            "user_id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "created_at": str(asyncio.get_event_loop().time()),
            "status": "active"
        }
        
        metadata_file = self.sessions_dir / f"{session_name}_metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    async def list_sessions(self) -> list:
        """List all available sessions"""
        sessions = []
        for session_file in self.sessions_dir.glob("*.session"):
            metadata_file = session_file.with_suffix("").with_suffix("_metadata.json")
            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        sessions.append(metadata)
                except Exception:
                    # If metadata is corrupted, create basic info
                    sessions.append({
                        "session_name": session_file.stem,
                        "status": "unknown"
                    })
        
        return sessions
    
    async def test_session(self, session_name: str) -> str:
        """Test if a session is still valid"""
        session_file = self.sessions_dir / f"{session_name}.session"
        
        if not session_file.exists():
            return "Session file not found"
        
        try:
            client = TelegramClient(str(session_file), self.api_id, self.api_hash)
            await client.start()
            
            if await client.is_user_authorized():
                user = await client.get_me()
                await client.disconnect()
                return f"Session valid for {user.first_name}"
            else:
                await client.disconnect()
                return "Session expired or invalid"
                
        except Exception as e:
            return f"Error testing session: {str(e)}"

async def main():
    """Command line interface for session management"""
    parser = argparse.ArgumentParser(description="Telegram Session Loader")
    parser.add_argument("--phone", type=str, help="Phone number to create session")
    parser.add_argument("--otp", type=str, help="OTP code for verification")
    parser.add_argument("--session-name", type=str, help="Custom session name")
    parser.add_argument("--list", action="store_true", help="List all sessions")
    parser.add_argument("--test", type=str, help="Test a session by name")
    
    args = parser.parse_args()
    
    loader = SessionLoader()
    
    try:
        if args.list:
            sessions = await loader.list_sessions()
            print(json.dumps(sessions, indent=2))
        elif args.test:
            result = await loader.test_session(args.test)
            print(result)
        elif args.phone and args.otp:
            result = await loader.verify_otp(args.phone, args.otp, args.session_name)
            print(result)
        elif args.phone:
            result = await loader.create_session(args.phone, args.session_name)
            print(result)
        else:
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())