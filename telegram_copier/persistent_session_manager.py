#!/usr/bin/env python3
"""
Persistent Session Manager for AutoForwardX
Maintains long-lived Telethon client instances for OTP verification
"""

import asyncio
import json
import os
import sys
import time
from typing import Dict, Optional, Tuple
from telethon import TelegramClient
from telethon.errors import PhoneNumberInvalidError, FloodWaitError
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PersistentSessionManager:
    """Manages persistent Telethon client instances for OTP verification"""
    
    def __init__(self):
        self.active_clients: Dict[str, Dict] = {}
        self.phone_code_hashes: Dict[str, str] = {}
        self.session_timeouts: Dict[str, float] = {}
        self.cleanup_task = None
        
        # Load environment variables
        api_id_str = os.getenv('TELEGRAM_API_ID')
        self.api_hash = os.getenv('TELEGRAM_API_HASH')
        
        if not api_id_str or not self.api_hash:
            raise ValueError("TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables are required")
        
        try:
            self.api_id = int(api_id_str)
        except ValueError:
            raise ValueError("TELEGRAM_API_ID must be a valid integer")
            
        # Ensure sessions directory exists
        os.makedirs('sessions', exist_ok=True)
        
        # Start cleanup task
        self.start_cleanup_task()
    
    def start_cleanup_task(self):
        """Start the cleanup task for expired sessions"""
        if self.cleanup_task is None:
            self.cleanup_task = asyncio.create_task(self._cleanup_expired_sessions())
    
    async def _cleanup_expired_sessions(self):
        """Cleanup expired sessions every 30 seconds"""
        while True:
            try:
                await asyncio.sleep(30)
                current_time = time.time()
                expired_phones = []
                
                for phone, timeout in self.session_timeouts.items():
                    if current_time > timeout:
                        expired_phones.append(phone)
                
                for phone in expired_phones:
                    logger.info(f"Cleaning up expired session for {phone}")
                    await self._cleanup_session(phone)
                    
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    async def _cleanup_session(self, phone: str):
        """Clean up a specific session"""
        try:
            # Disconnect client if active
            if phone in self.active_clients:
                client_info = self.active_clients[phone]
                if 'client' in client_info:
                    try:
                        await client_info['client'].disconnect()
                    except Exception as e:
                        logger.error(f"Error disconnecting client for {phone}: {e}")
                
                del self.active_clients[phone]
            
            # Remove phone code hash
            if phone in self.phone_code_hashes:
                del self.phone_code_hashes[phone]
            
            # Remove timeout
            if phone in self.session_timeouts:
                del self.session_timeouts[phone]
                
            logger.info(f"Successfully cleaned up session for {phone}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session for {phone}: {e}")
    
    async def request_otp(self, phone: str, session_name: str) -> Dict:
        """Request OTP for a phone number using persistent client"""
        try:
            # Clean up any existing session for this phone
            if phone in self.active_clients:
                await self._cleanup_session(phone)
            
            # Create new client
            session_file = f"sessions/{session_name}.session"
            client = TelegramClient(session_file, self.api_id, self.api_hash)
            
            # Connect to Telegram
            await client.connect()
            
            # Request OTP
            logger.info(f"Requesting OTP for {phone}")
            sent_code = await client.send_code_request(phone)
            
            # Store client and phone code hash
            self.active_clients[phone] = {
                'client': client,
                'session_name': session_name,
                'session_file': session_file,
                'created_at': time.time()
            }
            
            self.phone_code_hashes[phone] = sent_code.phone_code_hash
            
            # Set timeout (5 minutes)
            self.session_timeouts[phone] = time.time() + 300
            
            logger.info(f"OTP sent successfully for {phone}")
            
            return {
                'success': True,
                'message': f'OTP sent to {phone}',
                'phone_code_hash': sent_code.phone_code_hash,
                'expires_in': 300000  # 5 minutes in milliseconds
            }
            
        except PhoneNumberInvalidError:
            return {
                'success': False,
                'message': 'Invalid phone number format'
            }
        except FloodWaitError as e:
            return {
                'success': False,
                'message': f'Please wait {e.seconds} seconds before requesting another OTP'
            }
        except Exception as e:
            logger.error(f"Error requesting OTP for {phone}: {e}")
            return {
                'success': False,
                'message': f'Failed to send OTP: {str(e)}'
            }
    
    async def verify_otp(self, phone: str, code: str) -> Dict:
        """Verify OTP using the same persistent client"""
        try:
            # Check if we have an active client for this phone
            if phone not in self.active_clients:
                return {
                    'success': False,
                    'message': 'No active OTP session found. Please request a new OTP.'
                }
            
            # Check if session has expired
            if phone in self.session_timeouts and time.time() > self.session_timeouts[phone]:
                await self._cleanup_session(phone)
                return {
                    'success': False,
                    'message': 'OTP session has expired. Please request a new OTP.'
                }
            
            # Get client and phone code hash
            client_info = self.active_clients[phone]
            client = client_info['client']
            phone_code_hash = self.phone_code_hashes.get(phone)
            
            if not phone_code_hash:
                return {
                    'success': False,
                    'message': 'Phone code hash not found. Please request a new OTP.'
                }
            
            # Verify the code
            logger.info(f"Verifying OTP for {phone}")
            user = await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
            
            # Success - save session and cleanup
            session_name = client_info['session_name']
            session_file = client_info['session_file']
            
            # Disconnect client (session is saved)
            await client.disconnect()
            
            # Clean up tracking data
            await self._cleanup_session(phone)
            
            logger.info(f"OTP verified successfully for {phone}")
            
            return {
                'success': True,
                'message': 'OTP verified successfully',
                'session': {
                    'sessionName': session_name,
                    'phoneNumber': phone,
                    'sessionFile': session_file,
                    'status': 'active',
                    'userId': user.id,
                    'username': user.username
                }
            }
            
        except Exception as e:
            logger.error(f"Error verifying OTP for {phone}: {e}")
            error_message = str(e)
            
            # Handle specific Telegram errors
            if "confirmation code has expired" in error_message:
                await self._cleanup_session(phone)
                return {
                    'success': False,
                    'message': 'OTP has expired. Please request a new code.'
                }
            elif "invalid code" in error_message:
                return {
                    'success': False,
                    'message': 'Invalid OTP code. Please try again.'
                }
            else:
                return {
                    'success': False,
                    'message': f'OTP verification failed: {error_message}'
                }
    
    async def get_session_status(self, phone: str) -> Dict:
        """Get status of an active session"""
        if phone not in self.active_clients:
            return {
                'hasSession': False,
                'message': 'No active session found'
            }
        
        if phone in self.session_timeouts:
            remaining_time = self.session_timeouts[phone] - time.time()
            if remaining_time <= 0:
                await self._cleanup_session(phone)
                return {
                    'hasSession': False,
                    'message': 'Session has expired'
                }
            
            return {
                'hasSession': True,
                'expiresIn': int(remaining_time * 1000),  # Convert to milliseconds
                'phoneNumber': phone
            }
        
        return {
            'hasSession': True,
            'phoneNumber': phone
        }
    
    async def resend_otp(self, phone: str) -> Dict:
        """Resend OTP using the same client"""
        try:
            # Check if we have an active client
            if phone not in self.active_clients:
                return {
                    'success': False,
                    'message': 'No active session found. Please start a new OTP request.'
                }
            
            client_info = self.active_clients[phone]
            client = client_info['client']
            
            # Resend code
            logger.info(f"Resending OTP for {phone}")
            sent_code = await client.resend_code(phone, self.phone_code_hashes[phone])
            
            # Update phone code hash and timeout
            self.phone_code_hashes[phone] = sent_code.phone_code_hash
            self.session_timeouts[phone] = time.time() + 300  # Reset 5-minute timeout
            
            logger.info(f"OTP resent successfully for {phone}")
            
            return {
                'success': True,
                'message': f'OTP resent to {phone}',
                'expires_in': 300000  # 5 minutes in milliseconds
            }
            
        except Exception as e:
            logger.error(f"Error resending OTP for {phone}: {e}")
            return {
                'success': False,
                'message': f'Failed to resend OTP: {str(e)}'
            }
    
    async def cleanup_all(self):
        """Cleanup all active sessions"""
        phones_to_cleanup = list(self.active_clients.keys())
        for phone in phones_to_cleanup:
            await self._cleanup_session(phone)
        
        if self.cleanup_task:
            self.cleanup_task.cancel()
            self.cleanup_task = None

# Global manager instance
manager = None

async def get_manager():
    """Get or create the global session manager"""
    global manager
    if manager is None:
        manager = PersistentSessionManager()
    return manager

async def main():
    """Main entry point for standalone usage"""
    if len(sys.argv) < 2:
        print("Usage: python persistent_session_manager.py <command> [args...]")
        print("Commands:")
        print("  request_otp <phone> <session_name>")
        print("  verify_otp <phone> <code>")
        print("  resend_otp <phone>")
        print("  get_status <phone>")
        sys.exit(1)
    
    command = sys.argv[1]
    session_manager = await get_manager()
    
    try:
        if command == "request_otp":
            if len(sys.argv) < 4:
                print("Usage: request_otp <phone> <session_name>")
                sys.exit(1)
            
            phone = sys.argv[2]
            session_name = sys.argv[3]
            result = await session_manager.request_otp(phone, session_name)
            print(json.dumps(result, indent=2))
        
        elif command == "verify_otp":
            if len(sys.argv) < 4:
                print("Usage: verify_otp <phone> <code>")
                sys.exit(1)
            
            phone = sys.argv[2]
            code = sys.argv[3]
            result = await session_manager.verify_otp(phone, code)
            print(json.dumps(result, indent=2))
        
        elif command == "resend_otp":
            if len(sys.argv) < 3:
                print("Usage: resend_otp <phone>")
                sys.exit(1)
            
            phone = sys.argv[2]
            result = await session_manager.resend_otp(phone)
            print(json.dumps(result, indent=2))
        
        elif command == "get_status":
            if len(sys.argv) < 3:
                print("Usage: get_status <phone>")
                sys.exit(1)
            
            phone = sys.argv[2]
            result = await session_manager.get_session_status(phone)
            print(json.dumps(result, indent=2))
        
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\nShutting down...")
        await session_manager.cleanup_all()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())