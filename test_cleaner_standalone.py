#!/usr/bin/env python3
"""
Standalone test for the Discord message cleaner functionality
(without Discord dependencies)
"""

import json
import re
import logging
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

class MessageCleaner:
    """Advanced message cleaning system for Discord to Telegram forwarding"""
    
    def __init__(self):
        self.config_file = Path('cleaner_config.json')
        self.edit_counts: Dict[str, int] = {}
        self.config = self.load_config()
        self.cleaner_logger = self._setup_cleaner_logger()
    
    def _setup_cleaner_logger(self):
        """Setup dedicated logger for message cleaning"""
        cleaner_logger = logging.getLogger('discord_cleaner')
        cleaner_logger.setLevel(logging.INFO)
        
        # Create logs directory if it doesn't exist
        Path('logs').mkdir(exist_ok=True)
        
        # File handler for cleaner logs
        handler = logging.FileHandler('logs/discord_cleaner.log')
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        cleaner_logger.addHandler(handler)
        
        return cleaner_logger
    
    def load_config(self) -> Dict[str, Any]:
        """Load cleaning configuration from JSON file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                print(f"Config file {self.config_file} not found, using defaults")
                return self._get_default_config()
        except Exception as e:
            print(f"Error loading cleaner config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default cleaning configuration"""
        return {
            "header_patterns": ["^#\\w+", "^(VIP|🔥|ENTRY)\\b", "^[*]{2,}.*[*]{2,}$"],
            "footer_patterns": ["shared by .*", "autocopy.*", "join .*"],
            "mention_patterns": ["@\\w+", "@everyone", "@here"],
            "spam_patterns": ["🔥{3,}", "!{3,}", "\\?{3,}", "\\.{4,}"],
            "edit_trap_threshold": 3,
            "max_message_length": 4000
        }
    
    def clean_discord_message(self, text: str, message_id: str = None) -> Tuple[str, bool]:
        """
        Main message cleaning function
        
        Args:
            text: Raw Discord message text
            message_id: Discord message ID for edit tracking
            
        Returns:
            Tuple[cleaned_text, is_trap]
        """
        if not text or not text.strip():
            return "", False
        
        original_text = text
        is_trap = False
        trap_reasons = []
        
        try:
            # 1. Check for edit traps
            if message_id:
                edit_count = self.edit_counts.get(message_id, 0)
                if edit_count >= self.config.get('edit_trap_threshold', 3):
                    is_trap = True
                    trap_reasons.append(f"edit_trap_count_{edit_count}")
                    print(f"Edit trap detected for message {message_id}: {edit_count} edits")
            
            # 2. Remove mentions while preserving context
            text = self._remove_mentions(text)
            
            # 3. Remove header patterns
            text, header_removed = self._remove_header_patterns(text)
            if header_removed:
                trap_reasons.append("header_pattern")
            
            # 4. Remove footer patterns
            text, footer_removed = self._remove_footer_patterns(text)
            if footer_removed:
                trap_reasons.append("footer_pattern")
            
            # 5. Clean spam patterns while preserving formatting
            text = self._clean_spam_patterns(text)
            
            # 6. Normalize formatting
            text = self._normalize_formatting(text)
            
            # 7. Check for specific trap text patterns
            text = text.strip()
            trap_patterns = self.config.get('trap_text_patterns', [])
            for pattern in trap_patterns:
                if re.match(pattern, text, re.IGNORECASE):
                    is_trap = True
                    trap_reasons.append(f"trap_pattern_{pattern}")
                    break
            
            # 8. Final validation
            # Check if message became empty or too short after cleaning
            if len(text) < 3 or text.lower() in ['...', '..', '.', 'edit', 'deleted']:
                is_trap = True
                trap_reasons.append("content_too_short")
            
            # Check maximum length
            if len(text) > self.config.get('max_message_length', 4000):
                text = text[:self.config.get('max_message_length', 4000)] + "..."
                print(f"Message truncated to {self.config.get('max_message_length', 4000)} characters")
            
            # Log cleaning action
            if trap_reasons or len(text) != len(original_text):
                print(f"Message cleaned: trap={is_trap}, reasons={trap_reasons}, "
                     f"original_length={len(original_text)}, cleaned_length={len(text)}")
            
            return text, is_trap
            
        except Exception as e:
            print(f"Error cleaning message: {e}")
            return original_text, False
    
    def _remove_mentions(self, text: str) -> str:
        """Remove Discord mentions while preserving context"""
        mention_patterns = self.config.get('mention_patterns', ['@\\w+', '@everyone', '@here'])
        
        for pattern in mention_patterns:
            # Remove mentions but preserve surrounding context
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)
        
        # Clean up extra whitespace left by mention removal
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _remove_header_patterns(self, text: str) -> Tuple[str, bool]:
        """Remove header trap patterns"""
        lines = text.split('\n')
        header_patterns = self.config.get('header_patterns', [])
        removed = False
        
        # Remove lines from the beginning that match header patterns
        while lines and header_patterns:
            line = lines[0].strip()
            if not line:
                lines.pop(0)
                continue
                
            line_removed = False
            for pattern in header_patterns:
                if re.match(pattern, line, re.IGNORECASE | re.UNICODE):
                    lines.pop(0)
                    removed = True
                    line_removed = True
                    print(f"Removed header pattern: {line[:50]}...")
                    break
            
            if not line_removed:
                break
        
        return '\n'.join(lines), removed
    
    def _remove_footer_patterns(self, text: str) -> Tuple[str, bool]:
        """Remove footer trap patterns"""
        lines = text.split('\n')
        footer_patterns = self.config.get('footer_patterns', [])
        removed = False
        
        # Remove lines from the end that match footer patterns
        while lines and footer_patterns:
            line = lines[-1].strip()
            if not line:
                lines.pop()
                continue
                
            line_removed = False
            for pattern in footer_patterns:
                if re.search(pattern, line, re.IGNORECASE | re.UNICODE):
                    lines.pop()
                    removed = True
                    line_removed = True
                    print(f"Removed footer pattern: {line[:50]}...")
                    break
            
            if not line_removed:
                break
        
        return '\n'.join(lines), removed
    
    def _clean_spam_patterns(self, text: str) -> str:
        """Clean spam patterns while preserving formatting"""
        spam_patterns = self.config.get('spam_patterns', [])
        
        for pattern in spam_patterns:
            if pattern == "🔥{3,}":
                # Replace multiple fire emojis with single one
                text = re.sub(r'🔥{3,}', '🔥', text)
            elif pattern == "!{3,}":
                # Replace multiple exclamation marks with single one
                text = re.sub(r'!{3,}', '!', text)
            elif pattern == "\\?{3,}":
                # Replace multiple question marks with single one
                text = re.sub(r'\?{3,}', '?', text)
            elif pattern == "\\.{4,}":
                # Replace multiple dots with ellipsis
                text = re.sub(r'\.{4,}', '...', text)
            else:
                # Generic pattern replacement
                text = re.sub(pattern, '', text)
        
        return text
    
    def _normalize_formatting(self, text: str) -> str:
        """Normalize formatting while preserving Telegram-compatible formatting"""
        # Remove excessive whitespace but preserve paragraph breaks
        text = re.sub(r' +', ' ', text)  # Multiple spaces to single space
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Multiple newlines to double newline
        text = re.sub(r'^\s+|\s+$', '', text, flags=re.MULTILINE)  # Trim line whitespace
        
        return text.strip()
    
    def increment_edit_count(self, message_id: str) -> int:
        """Increment edit count for a message and return new count"""
        if message_id not in self.edit_counts:
            self.edit_counts[message_id] = 0
        self.edit_counts[message_id] += 1
        
        count = self.edit_counts[message_id]
        print(f"Message {message_id} edit count: {count}")
        
        return count

def test_message_cleaner():
    """Test the message cleaning functionality"""
    
    print("🧪 Testing Message Cleaner Functionality")
    print("=" * 50)
    
    # Initialize cleaner
    cleaner = MessageCleaner()
    
    # Test cases
    test_cases = [
        {
            "name": "Normal Message",
            "input": "This is a normal trading signal with **bold text** and some content.",
            "expected_trap": False
        },
        {
            "name": "Header Trap",
            "input": "***SIGNAL***\nBuy BTCUSDT at 45000\nStop loss: 44000",
            "expected_trap": True
        },
        {
            "name": "Footer Trap",
            "input": "Buy ETHUSDT at 3000\nTake profit: 3200\nshared by @tradingbot",
            "expected_trap": True  
        },
        {
            "name": "Mention Removal",
            "input": "Hey @everyone, check this out @username! Buy now @here",
            "expected_trap": False
        },
        {
            "name": "Spam Patterns",
            "input": "🔥🔥🔥🔥🔥 AMAZING SIGNAL!!!!! Buy now??????",
            "expected_trap": False
        },
        {
            "name": "Empty After Cleaning",
            "input": "/ *",
            "expected_trap": True
        },
        {
            "name": "VIP Header",
            "input": "#VIP SIGNAL\nBuy ADAUSDT\nTarget: 1.5",
            "expected_trap": True
        },
        {
            "name": "Complex Message",
            "input": "🔥🔥🔥 VIP SIGNAL 🔥🔥🔥\nBuy SOLUSDT at 100\n**Target**: 120\n_Stop Loss_: 95\nAutoCopy Bot v2.1",
            "expected_trap": True
        }
    ]
    
    # Run tests
    passed = 0
    failed = 0
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}: {test['name']}")
        print(f"Input: {repr(test['input'])}")
        
        try:
            cleaned_text, is_trap = cleaner.clean_discord_message(test['input'], f"test_msg_{i}")
            
            print(f"Output: {repr(cleaned_text)}")
            print(f"Is Trap: {is_trap}")
            print(f"Expected Trap: {test['expected_trap']}")
            
            if is_trap == test['expected_trap']:
                print("✅ PASSED")
                passed += 1
            else:
                print("❌ FAILED")
                failed += 1
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
            failed += 1
    
    # Test edit tracking
    print(f"\n📋 Test Edit Tracking")
    message_id = "edit_test_123"
    for edit_num in range(1, 6):
        count = cleaner.increment_edit_count(message_id)
        print(f"Edit {edit_num}: Count = {count}")
    
    # Test with edit trap
    test_text = "This message will be edited multiple times"
    for edit_attempt in range(1, 5):
        cleaned_text, is_trap = cleaner.clean_discord_message(test_text, message_id)
        print(f"Edit {edit_attempt}: is_trap = {is_trap}")
    
    print(f"\n📊 Results:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
    
    return passed, failed

if __name__ == "__main__":
    print("AutoForwardX Message Cleaner Test Suite")
    print("=" * 60)
    
    passed, failed = test_message_cleaner()
    
    if failed == 0:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️ {failed} tests failed. Check the implementation.")