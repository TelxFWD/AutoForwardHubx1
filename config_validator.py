"""
Secure configuration validation for AutoForwardX
Validates and manages environment variables and configuration files
"""

import os
import logging
import re
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from pydantic import BaseModel, Field, validator, SecretStr
from pydantic import ValidationError
import json

logger = logging.getLogger(__name__)

class TelegramConfig(BaseModel):
    """Telegram API configuration"""
    api_id: int = Field(..., description="Telegram API ID")
    api_hash: SecretStr = Field(..., description="Telegram API Hash")
    
    @validator('api_id')
    def validate_api_id(cls, v):
        if v <= 0:
            raise ValueError('API ID must be positive')
        return v
    
    @validator('api_hash')
    def validate_api_hash(cls, v):
        if len(v.get_secret_value()) < 10:
            raise ValueError('API Hash appears to be invalid')
        return v

class BotTokenConfig(BaseModel):
    """Bot token configuration"""
    token: SecretStr = Field(..., description="Bot token")
    
    @validator('token')
    def validate_bot_token(cls, v):
        token = v.get_secret_value()
        # Telegram bot token format: 123456789:ABCDEF...
        if not re.match(r'^\d{8,10}:[A-Za-z0-9_-]{35}$', token):
            raise ValueError('Invalid bot token format')
        return v

class SessionConfig(BaseModel):
    """Session configuration"""
    name: str = Field(..., min_length=1, max_length=50)
    phone: str = Field(..., description="Phone number")
    session_file: str = Field(..., description="Session file path")
    status: str = Field(default="active", regex="^(active|inactive|error)$")
    
    @validator('phone')
    def validate_phone(cls, v):
        # Basic phone number validation
        if not re.match(r'^\+\d{7,15}$', v):
            raise ValueError('Phone number must be in international format (+1234567890)')
        return v
    
    @validator('session_file')
    def validate_session_file(cls, v):
        if not v.endswith('.session'):
            raise ValueError('Session file must have .session extension')
        return v

class PairConfig(BaseModel):
    """Pair configuration"""
    pair_name: str = Field(..., min_length=1, max_length=100)
    source_channel: str = Field(..., description="Source Telegram channel")
    discord_webhook: str = Field(..., description="Discord webhook URL")
    destination_channel: str = Field(..., description="Destination Telegram channel")
    bot_token: SecretStr = Field(..., description="Bot token for posting")
    session: str = Field(..., description="Session name to use")
    status: str = Field(default="active", regex="^(active|paused|error)$")
    enable_ai: bool = Field(default=False)
    
    @validator('source_channel', 'destination_channel')
    def validate_channel(cls, v):
        # Must be username (@channel) or chat ID (-1001234567890)
        if not (v.startswith('@') or (v.startswith('-') and v[1:].isdigit())):
            raise ValueError('Channel must be username (@channel) or chat ID (-1001234567890)')
        return v
    
    @validator('discord_webhook')
    def validate_webhook_url(cls, v):
        webhook_pattern = r'https://discord\.com/api/webhooks/\d+/[A-Za-z0-9_-]+'
        if not re.match(webhook_pattern, v):
            raise ValueError('Invalid Discord webhook URL format')
        return v

class BlocklistConfig(BaseModel):
    """Blocklist configuration"""
    global_blocklist: Dict[str, List[str]] = Field(default_factory=lambda: {"text": [], "images": []})
    pair_blocklist: Dict[str, Dict[str, List[str]]] = Field(default_factory=dict)
    
    @validator('global_blocklist')
    def validate_global_blocklist(cls, v):
        required_keys = {"text", "images"}
        if not required_keys.issubset(v.keys()):
            raise ValueError(f'Global blocklist must contain keys: {required_keys}')
        return v

class EnvironmentConfig(BaseModel):
    """Environment variables configuration"""
    telegram_api_id: int = Field(..., env='TELEGRAM_API_ID')
    telegram_api_hash: SecretStr = Field(..., env='TELEGRAM_API_HASH')
    discord_bot_token: Optional[SecretStr] = Field(None, env='DISCORD_BOT_TOKEN')
    admin_bot_token: Optional[SecretStr] = Field(None, env='ADMIN_BOT_TOKEN')
    admin_user_ids: Optional[str] = Field(None, env='ADMIN_USER_IDS')
    database_url: Optional[str] = Field(None, env='DATABASE_URL')
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'

class ConfigValidator:
    """Main configuration validator"""
    
    def __init__(self, config_dir: str = "config"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(exist_ok=True)
        self.env_config = None
        self._load_environment()
    
    def _load_environment(self):
        """Load and validate environment variables"""
        try:
            self.env_config = EnvironmentConfig()
            logger.info("Environment configuration validated successfully")
        except ValidationError as e:
            logger.error(f"Environment validation failed: {e}")
            raise
    
    def get_telegram_config(self) -> TelegramConfig:
        """Get validated Telegram configuration"""
        if not self.env_config:
            raise ValueError("Environment not loaded")
        
        return TelegramConfig(
            api_id=self.env_config.telegram_api_id,
            api_hash=self.env_config.telegram_api_hash
        )
    
    def validate_sessions_config(self, sessions_data: Dict) -> List[SessionConfig]:
        """Validate sessions configuration"""
        validated_sessions = []
        
        for session_name, session_data in sessions_data.items():
            try:
                # Add session name if not present
                if 'name' not in session_data:
                    session_data['name'] = session_name
                
                session = SessionConfig(**session_data)
                validated_sessions.append(session)
            except ValidationError as e:
                logger.error(f"Invalid session config for {session_name}: {e}")
                raise
        
        return validated_sessions
    
    def validate_pairs_config(self, pairs_data: List[Dict]) -> List[PairConfig]:
        """Validate pairs configuration"""
        validated_pairs = []
        
        for i, pair_data in enumerate(pairs_data):
            try:
                pair = PairConfig(**pair_data)
                validated_pairs.append(pair)
            except ValidationError as e:
                logger.error(f"Invalid pair config at index {i}: {e}")
                raise
        
        return validated_pairs
    
    def validate_blocklist_config(self, blocklist_data: Dict) -> BlocklistConfig:
        """Validate blocklist configuration"""
        try:
            return BlocklistConfig(**blocklist_data)
        except ValidationError as e:
            logger.error(f"Invalid blocklist config: {e}")
            raise
    
    def validate_bot_token(self, token: str) -> BotTokenConfig:
        """Validate a bot token"""
        try:
            return BotTokenConfig(token=token)
        except ValidationError as e:
            logger.error(f"Invalid bot token: {e}")
            raise
    
    def load_and_validate_config_file(self, filename: str, validator_func) -> Any:
        """Load and validate a configuration file"""
        config_file = self.config_dir / filename
        
        if not config_file.exists():
            logger.warning(f"Config file {filename} not found")
            return None
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return validator_func(data)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {filename}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading {filename}: {e}")
            raise
    
    def validate_all_configs(self) -> Dict[str, Any]:
        """Validate all configuration files"""
        results = {}
        
        # Validate pairs
        pairs = self.load_and_validate_config_file(
            "pairs.json", 
            self.validate_pairs_config
        )
        if pairs:
            results['pairs'] = pairs
        
        # Validate sessions
        sessions = self.load_and_validate_config_file(
            "sessions.json",
            self.validate_sessions_config
        )
        if sessions:
            results['sessions'] = sessions
        
        # Validate blocklist
        blocklist = self.load_and_validate_config_file(
            "blocklist.json",
            self.validate_blocklist_config
        )
        if blocklist:
            results['blocklist'] = blocklist
        
        return results
    
    def mask_sensitive_data(self, data: Any, mask_char: str = "*") -> Any:
        """Mask sensitive data for logging"""
        if isinstance(data, dict):
            masked = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in ['token', 'password', 'secret', 'key', 'hash']):
                    if isinstance(value, str) and len(value) > 8:
                        masked[key] = value[:4] + mask_char * (len(value) - 8) + value[-4:]
                    else:
                        masked[key] = mask_char * 8
                else:
                    masked[key] = self.mask_sensitive_data(value, mask_char)
            return masked
        elif isinstance(data, list):
            return [self.mask_sensitive_data(item, mask_char) for item in data]
        else:
            return data
    
    def get_environment_status(self) -> Dict[str, Any]:
        """Get environment configuration status"""
        status = {
            "telegram_api_configured": bool(self.env_config and self.env_config.telegram_api_id),
            "discord_bot_configured": bool(self.env_config and self.env_config.discord_bot_token),
            "admin_bot_configured": bool(self.env_config and self.env_config.admin_bot_token),
            "database_configured": bool(self.env_config and self.env_config.database_url),
            "admin_users_configured": bool(self.env_config and self.env_config.admin_user_ids)
        }
        
        return status
    
    def create_sample_configs(self):
        """Create sample configuration files"""
        
        # Sample pairs configuration
        sample_pairs = [
            {
                "pair_name": "Sample Pair",
                "source_channel": "@source_channel",
                "discord_webhook": "https://discord.com/api/webhooks/123456789/sample_webhook_token",
                "destination_channel": "@destination_channel",
                "bot_token": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
                "session": "main_session",
                "status": "active",
                "enable_ai": False
            }
        ]
        
        # Sample sessions configuration
        sample_sessions = {
            "main_session": {
                "name": "main_session",
                "phone": "+1234567890",
                "session_file": "main_session.session",
                "status": "active"
            }
        }
        
        # Sample blocklist configuration
        sample_blocklist = {
            "global_blocklist": {
                "text": ["trap", "leak", "/ *", "1"],
                "images": []
            },
            "pair_blocklist": {}
        }
        
        # Write sample files
        samples = [
            ("pairs.json.example", sample_pairs),
            ("sessions.json.example", sample_sessions),
            ("blocklist.json.example", sample_blocklist)
        ]
        
        for filename, data in samples:
            sample_file = self.config_dir / filename
            if not sample_file.exists():
                with open(sample_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
                logger.info(f"Created sample config: {filename}")

# Global validator instance
config_validator = ConfigValidator()

def validate_environment() -> bool:
    """Validate environment variables"""
    try:
        config_validator.get_telegram_config()
        return True
    except Exception as e:
        logger.error(f"Environment validation failed: {e}")
        return False

def get_masked_config(config_data: Any) -> Any:
    """Get configuration with sensitive data masked"""
    return config_validator.mask_sensitive_data(config_data)

if __name__ == "__main__":
    # Test configuration validation
    try:
        env_status = config_validator.get_environment_status()
        print("Environment Status:", env_status)
        
        if validate_environment():
            print("Environment validation: PASSED")
        else:
            print("Environment validation: FAILED")
        
        # Validate all configs
        configs = config_validator.validate_all_configs()
        print(f"Validated {len(configs)} configuration files")
        
        # Create sample configs
        config_validator.create_sample_configs()
        
    except Exception as e:
        logger.error(f"Configuration validation failed: {e}")