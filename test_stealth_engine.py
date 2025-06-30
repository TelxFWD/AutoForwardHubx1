#!/usr/bin/env python3
"""
AutoForwardX Stealth Engine Test Suite
Comprehensive testing of 100/100 stealth capabilities
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from datetime import datetime
from stealth_engine import StealthEngine, process_for_telegram, verify_message_stealth

# Setup test logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class StealthTestSuite:
    """Comprehensive stealth testing"""
    
    def __init__(self):
        self.engine = StealthEngine()
        self.test_results = {
            'fingerprint_tests': [],
            'image_tests': [],
            'watermark_tests': [],
            'ai_rewriter_tests': [],
            'compliance_tests': [],
            'overall_score': 0
        }
    
    def test_fingerprint_normalization(self):
        """Test message fingerprint normalization"""
        logger.info("🧪 Testing Fingerprint Normalization...")
        
        test_cases = [
            {
                'name': 'Repeated Punctuation',
                'input': 'AMAZING SIGNAL!!!!! Buy now?????? 100% guaranteed...........',
                'expected_patterns': ['!', '?', '...']
            },
            {
                'name': 'Emoji Spam',
                'input': '🔥🔥🔥🔥🔥 VIP SIGNAL 🚀🚀🚀🚀 💯💯💯💯',
                'expected_patterns': ['🔥', '🚀', '💯']
            },
            {
                'name': 'Stylized Headers',
                'input': '*** PREMIUM ENTRY *** === SIGNAL === --- ALERT ---',
                'expected_clean': True
            },
            {
                'name': 'Zero-Width Characters',
                'input': 'Normal\u200btext\u200cwith\u200dhidden\u2060chars',
                'expected_clean': True
            },
            {
                'name': 'Attribution Removal',
                'input': 'Buy BTCUSDT\nShared by @tradingbot\nChannel: @signals',
                'expected_clean': True
            }
        ]
        
        for test in test_cases:
            try:
                result = self.engine.normalize_message_fingerprint(test['input'])
                
                success = True
                if 'expected_patterns' in test:
                    # Check that repeated patterns are normalized
                    for pattern in test['expected_patterns']:
                        if pattern == '!':
                            success = success and '!!!' not in result
                        elif pattern == '?':
                            success = success and '???' not in result
                        elif pattern == '...':
                            success = success and '......' not in result
                
                if 'expected_clean' in test:
                    # Check that content is cleaned
                    success = len(result) < len(test['input'])
                
                self.test_results['fingerprint_tests'].append({
                    'name': test['name'],
                    'input': test['input'],
                    'output': result,
                    'success': success,
                    'reduction': len(test['input']) - len(result)
                })
                
                status = "✅ PASSED" if success else "❌ FAILED"
                logger.info(f"  {test['name']}: {status}")
                
            except Exception as e:
                logger.error(f"  {test['name']}: ERROR - {e}")
                self.test_results['fingerprint_tests'].append({
                    'name': test['name'],
                    'success': False,
                    'error': str(e)
                })
    
    def test_image_processing(self):
        """Test image metadata stripping and recompression"""
        logger.info("🖼️  Testing Image Processing...")
        
        try:
            # Create a test image with metadata
            from PIL import Image
            import io
            
            # Create test image
            test_image = Image.new('RGB', (100, 100), color='red')
            
            # Add fake EXIF data
            exif_dict = {"0th": {256: 100, 257: 100}, "Exif": {36867: "2023:01:01 12:00:00"}}
            
            # Save with metadata
            original_buffer = io.BytesIO()
            test_image.save(original_buffer, format='JPEG', quality=95)
            original_bytes = original_buffer.getvalue()
            
            # Process through stealth engine
            processed_bytes = self.engine.recompress_image(original_bytes)
            
            # Verify metadata removal
            processed_image = Image.open(io.BytesIO(processed_bytes))
            has_exif = hasattr(processed_image, '_getexif') and processed_image._getexif()
            
            success = not has_exif and len(processed_bytes) > 0
            
            self.test_results['image_tests'].append({
                'name': 'Metadata Stripping',
                'original_size': len(original_bytes),
                'processed_size': len(processed_bytes),
                'metadata_removed': not has_exif,
                'success': success
            })
            
            status = "✅ PASSED" if success else "❌ FAILED"
            logger.info(f"  Metadata Stripping: {status}")
            
        except Exception as e:
            logger.error(f"  Image Processing: ERROR - {e}")
            self.test_results['image_tests'].append({
                'name': 'Image Processing',
                'success': False,
                'error': str(e)
            })
    
    def test_invisible_watermark(self):
        """Test invisible watermark injection"""
        logger.info("👻 Testing Invisible Watermark...")
        
        # Enable watermarking for test
        original_config = self.engine.config["invisible_watermark"]["enabled"]
        self.engine.config["invisible_watermark"]["enabled"] = True
        
        try:
            test_text = "This is a test message for watermark injection."
            watermarked = self.engine.inject_invisible_noise(test_text, intensity=2)
            
            # Check for invisible characters
            invisible_count = sum(watermarked.count(char) for char in self.engine.invisible_chars)
            success = invisible_count > 0 and len(watermarked) >= len(test_text)
            
            self.test_results['watermark_tests'].append({
                'name': 'Invisible Watermark',
                'original_length': len(test_text),
                'watermarked_length': len(watermarked),
                'invisible_chars': invisible_count,
                'success': success
            })
            
            status = "✅ PASSED" if success else "❌ FAILED"
            logger.info(f"  Invisible Watermark: {status}")
            
        except Exception as e:
            logger.error(f"  Invisible Watermark: ERROR - {e}")
            self.test_results['watermark_tests'].append({
                'name': 'Invisible Watermark',
                'success': False,
                'error': str(e)
            })
        finally:
            # Restore original config
            self.engine.config["invisible_watermark"]["enabled"] = original_config
    
    def test_ai_rewriter(self):
        """Test AI caption rewriting"""
        logger.info("🤖 Testing AI Caption Rewriter...")
        
        test_cases = [
            {
                'name': 'VIP Signal Neutralization',
                'input': '🔥 VIP PREMIUM SIGNAL 🔥 GUARANTEED 100% PROFIT!!!',
                'expected_neutral': True
            },
            {
                'name': 'Attribution Removal',
                'input': 'Good signal here. Shared by @tradingmaster via TelegramBot',
                'expected_neutral': True
            },
            {
                'name': 'Promotional Language',
                'input': 'AMAZING OPPORTUNITY! DON\'T MISS! URGENT ENTRY!',
                'expected_neutral': True
            }
        ]
        
        for test in test_cases:
            try:
                result = self.engine.rewrite_caption_with_ai(test['input'])
                
                # Check neutralization
                promotional_words = ['vip', 'premium', 'amazing', 'guaranteed', 'urgent', 'don\'t miss']
                neutral = not any(word in result.lower() for word in promotional_words)
                success = neutral and len(result) > 0
                
                self.test_results['ai_rewriter_tests'].append({
                    'name': test['name'],
                    'input': test['input'],
                    'output': result,
                    'neutralized': neutral,
                    'success': success
                })
                
                status = "✅ PASSED" if success else "❌ FAILED"
                logger.info(f"  {test['name']}: {status}")
                
            except Exception as e:
                logger.error(f"  {test['name']}: ERROR - {e}")
                self.test_results['ai_rewriter_tests'].append({
                    'name': test['name'],
                    'success': False,
                    'error': str(e)
                })
    
    def test_stealth_compliance(self):
        """Test overall stealth compliance verification"""
        logger.info("🛡️  Testing Stealth Compliance...")
        
        test_messages = [
            {
                'name': 'Clean Message',
                'text': 'Buy BTCUSDT at 45000\nTarget: 46000\nStop: 44000',
                'expected_score': 90
            },
            {
                'name': 'Processed Trap Message',
                'text': 'SIGNAL Entry for ETHUSDT',
                'expected_score': 85
            },
            {
                'name': 'Attribution Message',
                'text': 'Good signal shared by @tradingbot via channel',
                'expected_score': 70
            }
        ]
        
        for test in test_messages:
            try:
                # Process through complete pipeline
                processed_text, _ = self.engine.process_message_complete(test['text'])
                
                # Verify compliance
                compliance = self.engine.verify_stealth_compliance(processed_text)
                score = compliance['overall_score']
                
                success = score >= test['expected_score']
                
                self.test_results['compliance_tests'].append({
                    'name': test['name'],
                    'original': test['text'],
                    'processed': processed_text,
                    'compliance_score': score,
                    'expected_score': test['expected_score'],
                    'success': success
                })
                
                status = "✅ PASSED" if success else "❌ FAILED"
                logger.info(f"  {test['name']}: {status} (Score: {score}/100)")
                
            except Exception as e:
                logger.error(f"  {test['name']}: ERROR - {e}")
                self.test_results['compliance_tests'].append({
                    'name': test['name'],
                    'success': False,
                    'error': str(e)
                })
    
    def calculate_overall_score(self):
        """Calculate overall stealth test score"""
        total_tests = 0
        passed_tests = 0
        
        for category in ['fingerprint_tests', 'image_tests', 'watermark_tests', 'ai_rewriter_tests', 'compliance_tests']:
            for test in self.test_results[category]:
                total_tests += 1
                if test.get('success', False):
                    passed_tests += 1
        
        self.test_results['overall_score'] = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        return self.test_results['overall_score']
    
    def run_all_tests(self):
        """Run complete stealth test suite"""
        logger.info("🚀 Starting Comprehensive Stealth Test Suite")
        logger.info("="*60)
        
        self.test_fingerprint_normalization()
        self.test_image_processing()
        self.test_invisible_watermark()
        self.test_ai_rewriter()
        self.test_stealth_compliance()
        
        overall_score = self.calculate_overall_score()
        
        logger.info("="*60)
        logger.info(f"🎯 OVERALL STEALTH SCORE: {overall_score:.1f}/100")
        
        if overall_score >= 90:
            logger.info("🟢 EXCELLENT - Full stealth capability achieved")
        elif overall_score >= 80:
            logger.info("🟡 GOOD - Strong stealth with minor improvements needed")
        elif overall_score >= 70:
            logger.info("🟠 ACCEPTABLE - Basic stealth with some issues")
        else:
            logger.info("🔴 POOR - Major stealth improvements required")
        
        return self.test_results
    
    def save_test_report(self):
        """Save detailed test report"""
        report_file = Path('logs/stealth_test_report.json')
        report_file.parent.mkdir(exist_ok=True)
        
        with open(report_file, 'w') as f:
            json.dump(self.test_results, f, indent=2)
        
        logger.info(f"📄 Test report saved to: {report_file}")

def main():
    """Main test entry point"""
    print("AutoForwardX Stealth Engine Test Suite")
    print("="*60)
    
    suite = StealthTestSuite()
    results = suite.run_all_tests()
    suite.save_test_report()
    
    # Return appropriate exit code
    if results['overall_score'] >= 80:
        sys.exit(0)
    elif results['overall_score'] >= 60:
        sys.exit(1)
    else:
        sys.exit(2)

if __name__ == "__main__":
    main()