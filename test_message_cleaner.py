#!/usr/bin/env python3
"""
Test script for the Discord message cleaner functionality
"""

import sys
import json
from pathlib import Path

# Add the project root to path
sys.path.append('.')

from discord_bot import MessageCleaner

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
    
    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️ Some tests failed. Check the implementation.")
        return False

def test_config_loading():
    """Test configuration loading"""
    print("\n🔧 Testing Configuration Loading")
    print("=" * 40)
    
    cleaner = MessageCleaner()
    config = cleaner.config
    
    print(f"Header patterns: {len(config.get('header_patterns', []))}")
    print(f"Footer patterns: {len(config.get('footer_patterns', []))}")
    print(f"Mention patterns: {len(config.get('mention_patterns', []))}")
    print(f"Spam patterns: {len(config.get('spam_patterns', []))}")
    print(f"Edit threshold: {config.get('edit_trap_threshold', 3)}")
    
    return True

if __name__ == "__main__":
    print("AutoForwardX Message Cleaner Test Suite")
    print("=" * 60)
    
    # Test configuration loading
    config_test = test_config_loading()
    
    # Test message cleaning
    cleaner_test = test_message_cleaner()
    
    if config_test and cleaner_test:
        print("\n🎯 All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)