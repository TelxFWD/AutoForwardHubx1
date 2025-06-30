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
    
    async def request_otp(self, phone_number: str, session_name: str = None) -> dict:
        """Send OTP to phone number"""
        if not session_name:
            # Generate session name from phone number
            clean_phone = phone_number.replace("+", "").replace("-", "").replace(" ", "")
            session_name = f"user_{clean_phone}"
        
        session_file = self.sessions_dir / f"{session_name}.session"
        
        try:
            client = TelegramClient(str(session_file), self.api_id, self.api_hash)
            await client.connect()
            
            # Check if already authorized
            if await client.is_user_authorized():
                user = await client.get_me()
                await client.disconnect()
                return {
                    "status": "already_logged_in",
                    "message": f"Phone already logged in as {user.first_name}",
                    "session_name": session_name
                }
            
            # Send OTP request
            sent = await client.send_code_request(phone_number)
            await client.disconnect()
            
            # Store pending session info
            pending_session = {
                "phone": phone_number,
                "session_name": session_name,
                "phone_code_hash": sent.phone_code_hash,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            pending_file = self.sessions_dir / f"{session_name}_pending.json"
            with open(pending_file, 'w', encoding='utf-8') as f:
                json.dump(pending_session, f, indent=2)
            
            return {
                "status": "otp_sent",
                "message": "OTP sent to your phone",
                "session_name": session_name
            }
                
        except PhoneNumberInvalidError:
            try:
                await client.disconnect()
            except:
                pass
            return {
                "status": "error",
                "message": "Phone number invalid or banned"
            }
        except Exception as e:
            try:
                await client.disconnect()
            except:
                pass
            return {
                "status": "error",
                "message": f"Error sending OTP: {str(e)}"
            }
    
    async def verify_otp(self, phone_number: str, otp_code: str, session_name: str = None) -> dict:
        """Verify OTP for session creation"""
        if not session_name:
            clean_phone = phone_number.replace("+", "").replace("-", "").replace(" ", "")
            session_name = f"user_{clean_phone}"
        
        session_file = self.sessions_dir / f"{session_name}.session"
        pending_file = self.sessions_dir / f"{session_name}_pending.json"
        
        try:
            # Load pending session data
            if not pending_file.exists():
                return {
                    "status": "error",
                    "message": "No pending OTP request found. Please request OTP first."
                }
            
            with open(pending_file, 'r', encoding='utf-8') as f:
                pending_data = json.load(f)
            
            client = TelegramClient(str(session_file), self.api_id, self.api_hash)
            await client.connect()
            
            # Verify OTP using stored phone_code_hash
            await client.sign_in(
                phone=phone_number,
                code=otp_code,
                phone_code_hash=pending_data["phone_code_hash"]
            )
            
            if await client.is_user_authorized():
                user = await client.get_me()
                await client.disconnect()
                
                # Save session metadata
                await self.save_session_metadata(session_name, phone_number, user)
                
                # Clean up pending file
                pending_file.unlink()
                
                return {
                    "status": "success",
                    "message": f"OTP verified successfully for {user.first_name}",
                    "session_name": session_name,
                    "user_info": {
                        "id": user.id,
                        "first_name": user.first_name,
                        "username": user.username
                    }
                }
            else:
                await client.disconnect()
                return {
                    "status": "error",
                    "message": "OTP verification failed"
                }
                
        except SessionPasswordNeededError:
            await client.disconnect()
            return {
                "status": "error",
                "message": "Two-step verification enabled. Please disable it temporarily."
            }
        except Exception as e:
            try:
                await client.disconnect()
            except:
                pass
            return {
                "status": "error",
                "message": f"Error verifying OTP: {str(e)}"
            }
    
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
            result = await loader.request_otp(args.phone, args.session_name)
            print(json.dumps(result, indent=2))
        else:
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())