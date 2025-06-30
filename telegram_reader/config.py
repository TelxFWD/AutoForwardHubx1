"""
Configuration management for AutoForwardX Telegram Reader
Handles loading and validation of pairs, sessions, and blocklists
"""

import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class PairConfig:
    pair_name: str
    source_tg_channel: str
    discord_webhook: str
    destination_tg_channel: str
    bot_token: str
    session: str
    status: str = "active"
    enable_ai: bool = False

@dataclass
class SessionConfig:
    name: str
    phone: str
    session_file: str
    status: str = "active"

@dataclass
class BlocklistConfig:
    global_blocklist: Dict[str, List[str]]
    pair_blocklist: Dict[str, Dict[str, List[str]]]

class ConfigManager:
    """Manages configuration files and provides centralized access"""
    
    def __init__(self, config_dir: str = "config"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(exist_ok=True)
        
        self.pairs_file = self.config_dir / "pairs.json"
        self.sessions_file = self.config_dir / "sessions.json"
        self.blocklist_file = self.config_dir / "blocklist.json"
        
        # Initialize default configs if files don't exist
        self._init_default_configs()
    
    def _init_default_configs(self):
        """Initialize default configuration files if they don't exist"""
        
        # Default pairs.json
        if not self.pairs_file.exists():
            default_pairs = [
                {
                    "pair_name": "GBPUSD_Demo",
                    "source_tg_channel": "@demo_source",
                    "discord_webhook": "https://discord.com/api/webhooks/demo",
                    "destination_tg_channel": "@demo_dest",
                    "bot_token": "TELEGRAM_BOT_TOKEN_HERE",
                    "session": "demo_session",
                    "status": "paused",
                    "enable_ai": False
                }
            ]
            self._save_json(self.pairs_file, default_pairs)
        
        # Default sessions.json
        if not self.sessions_file.exists():
            default_sessions = {
                "demo_session": {
                    "phone": "+1234567890",
                    "session_file": "demo_session.session",
                    "status": "inactive"
                }
            }
            self._save_json(self.sessions_file, default_sessions)
        
        # Default blocklist.json
        if not self.blocklist_file.exists():
            default_blocklist = {
                "global_blocklist": {
                    "text": ["trap", "/ *", "leak", "1", "copy warning"],
                    "images": []
                },
                "pair_blocklist": {}
            }
            self._save_json(self.blocklist_file, default_blocklist)
    
    def _load_json(self, file_path: Path) -> dict:
        """Load JSON file with error handling"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error loading {file_path}: {e}")
            return {}
    
    def _save_json(self, file_path: Path, data: dict):
        """Save data to JSON file with error handling"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving {file_path}: {e}")
    
    def get_pairs(self) -> List[PairConfig]:
        """Load and return all pair configurations"""
        pairs_data = self._load_json(self.pairs_file)
        if isinstance(pairs_data, list):
            return [PairConfig(**pair) for pair in pairs_data]
        return []
    
    def get_active_pairs(self) -> List[PairConfig]:
        """Return only active pairs"""
        return [pair for pair in self.get_pairs() if pair.status == "active"]
    
    def get_pair_by_name(self, name: str) -> Optional[PairConfig]:
        """Get specific pair by name"""
        for pair in self.get_pairs():
            if pair.pair_name == name:
                return pair
        return None
    
    def update_pair_status(self, pair_name: str, status: str):
        """Update the status of a specific pair"""
        pairs_data = self._load_json(self.pairs_file)
        if isinstance(pairs_data, list):
            for pair in pairs_data:
                if pair.get("pair_name") == pair_name:
                    pair["status"] = status
                    break
            self._save_json(self.pairs_file, pairs_data)
    
    def get_sessions(self) -> Dict[str, SessionConfig]:
        """Load and return all session configurations"""
        sessions_data = self._load_json(self.sessions_file)
        return {
            name: SessionConfig(name=name, **config) 
            for name, config in sessions_data.items()
        }
    
    def get_active_sessions(self) -> Dict[str, SessionConfig]:
        """Return only active sessions"""
        return {
            name: session for name, session in self.get_sessions().items() 
            if session.status == "active"
        }
    
    def update_session_status(self, session_name: str, status: str):
        """Update the status of a specific session"""
        sessions_data = self._load_json(self.sessions_file)
        if session_name in sessions_data:
            sessions_data[session_name]["status"] = status
            self._save_json(self.sessions_file, sessions_data)
    
    def get_blocklist(self) -> BlocklistConfig:
        """Load and return blocklist configuration"""
        blocklist_data = self._load_json(self.blocklist_file)
        return BlocklistConfig(
            global_blocklist=blocklist_data.get("global_blocklist", {"text": [], "images": []}),
            pair_blocklist=blocklist_data.get("pair_blocklist", {})
        )
    
    def add_blocked_text(self, text: str, pair_name: Optional[str] = None):
        """Add text to blocklist (global or pair-specific)"""
        blocklist_data = self._load_json(self.blocklist_file)
        
        if pair_name:
            # Add to pair-specific blocklist
            if pair_name not in blocklist_data.get("pair_blocklist", {}):
                blocklist_data.setdefault("pair_blocklist", {})[pair_name] = {"text": [], "images": []}
            if text not in blocklist_data["pair_blocklist"][pair_name]["text"]:
                blocklist_data["pair_blocklist"][pair_name]["text"].append(text)
        else:
            # Add to global blocklist
            if text not in blocklist_data.get("global_blocklist", {}).get("text", []):
                blocklist_data.setdefault("global_blocklist", {}).setdefault("text", []).append(text)
        
        self._save_json(self.blocklist_file, blocklist_data)
    
    def add_blocked_image(self, image_hash: str, pair_name: Optional[str] = None):
        """Add image hash to blocklist (global or pair-specific)"""
        blocklist_data = self._load_json(self.blocklist_file)
        
        if pair_name:
            # Add to pair-specific blocklist
            if pair_name not in blocklist_data.get("pair_blocklist", {}):
                blocklist_data.setdefault("pair_blocklist", {})[pair_name] = {"text": [], "images": []}
            if image_hash not in blocklist_data["pair_blocklist"][pair_name]["images"]:
                blocklist_data["pair_blocklist"][pair_name]["images"].append(image_hash)
        else:
            # Add to global blocklist
            if image_hash not in blocklist_data.get("global_blocklist", {}).get("images", []):
                blocklist_data.setdefault("global_blocklist", {}).setdefault("images", []).append(image_hash)
        
        self._save_json(self.blocklist_file, blocklist_data)
    
    def is_text_blocked(self, text: str, pair_name: str) -> bool:
        """Check if text is blocked (global or pair-specific)"""
        blocklist = self.get_blocklist()
        
        # Check global blocklist
        for blocked_text in blocklist.global_blocklist.get("text", []):
            if blocked_text.lower() in text.lower():
                return True
        
        # Check pair-specific blocklist
        pair_blocklist = blocklist.pair_blocklist.get(pair_name, {})
        for blocked_text in pair_blocklist.get("text", []):
            if blocked_text.lower() in text.lower():
                return True
        
        return False
    
    def is_image_blocked(self, image_hash: str, pair_name: str) -> bool:
        """Check if image hash is blocked (global or pair-specific)"""
        blocklist = self.get_blocklist()
        
        # Check global blocklist
        if image_hash in blocklist.global_blocklist.get("images", []):
            return True
        
        # Check pair-specific blocklist
        pair_blocklist = blocklist.pair_blocklist.get(pair_name, {})
        if image_hash in pair_blocklist.get("images", []):
            return True
        
        return False

# Global config manager instance
config_manager = ConfigManager()