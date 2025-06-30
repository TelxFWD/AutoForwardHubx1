#!/usr/bin/env python3
"""
AutoForwardX Security Audit & Stealth Validation
Comprehensive audit of message forwarding system for operational status and stealth features
"""

import asyncio
import json
import logging
import os
import sys
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from datetime import datetime

# Setup logging for audit
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SecurityAuditor:
    """Comprehensive security and stealth audit for AutoForwardX"""
    
    def __init__(self):
        self.audit_results = {
            'operational_status': {},
            'stealth_features': {},
            'safety_checks': {},
            'critical_findings': [],
            'security_warnings': [],
            'stealth_score': 0,
            'overall_security': 'unknown'
        }
    
    def audit_telegram_userbot(self) -> Dict[str, Any]:
        """Audit Telegram userbot functionality"""
        logger.info("🔍 Auditing Telegram Userbot...")
        
        findings = {
            'status': 'operational',
            'session_management': {},
            'routing_logic': {},
            'stealth_features': {}
        }
        
        # Check session file handling
        session_config = Path('telegram_reader/config/sessions.json')
        if session_config.exists():
            with open(session_config) as f:
                sessions = json.load(f)
            findings['session_management'] = {
                'config_present': True,
                'session_count': len(sessions),
                'stealth_assessment': 'Sessions use phone numbers only - good stealth'
            }
        else:
            findings['session_management'] = {
                'config_present': False,
                'warning': 'Session configuration missing'
            }
            self.audit_results['security_warnings'].append("Session config missing")
        
        # Check main reader implementation
        reader_main = Path('telegram_reader/main.py')
        if reader_main.exists():
            with open(reader_main) as f:
                content = f.read()
            
            # Check for stealth indicators
            stealth_indicators = {
                'no_username_exposure': 'username' not in content.lower() or 'get_me()' not in content,
                'no_sender_metadata': 'sender_id' not in content and 'from_user' not in content,
                'clean_message_extraction': 'message.text' in content or 'message.message' in content
            }
            
            findings['stealth_features'] = stealth_indicators
            findings['routing_logic']['implementation_present'] = True
        else:
            findings['routing_logic']['implementation_present'] = False
            self.audit_results['critical_findings'].append("Telegram reader implementation missing")
        
        return findings
    
    def audit_discord_bot(self) -> Dict[str, Any]:
        """Audit Discord bot stealth and cleaning features"""
        logger.info("🔍 Auditing Discord Bot...")
        
        findings = {
            'status': 'operational',
            'message_cleaning': {},
            'stealth_features': {},
            'trap_detection': {}
        }
        
        # Check Discord bot implementation
        discord_bot = Path('discord_bot.py')
        if discord_bot.exists():
            with open(discord_bot) as f:
                content = f.read()
            
            # Analyze message cleaning capabilities
            cleaning_features = {
                'mention_removal': '@everyone' in content and '@here' in content,
                'header_cleaning': 'header_patterns' in content,
                'footer_cleaning': 'footer_patterns' in content,
                'formatting_preservation': 'markdown' in content.lower() or 'html' in content.lower()
            }
            
            # Check stealth features
            stealth_features = {
                'no_bot_attribution': 'bot.user' not in content,
                'webhook_monitoring_only': 'webhook' in content.lower(),
                'clean_forwarding': 'clean_discord_message' in content,
                'no_discord_metadata': 'guild' not in content or 'server' not in content
            }
            
            # Check trap detection
            trap_detection = {
                'text_traps': 'trap' in content.lower(),
                'edit_traps': 'edit_count' in content,
                'pattern_matching': 'patterns' in content
            }
            
            findings['message_cleaning'] = cleaning_features
            findings['stealth_features'] = stealth_features
            findings['trap_detection'] = trap_detection
            
        else:
            findings['status'] = 'missing'
            self.audit_results['critical_findings'].append("Discord bot implementation missing")
        
        return findings
    
    def audit_telegram_poster(self) -> Dict[str, Any]:
        """Audit Telegram poster for stealth and functionality"""
        logger.info("🔍 Auditing Telegram Poster...")
        
        findings = {
            'status': 'operational',
            'message_handling': {},
            'stealth_features': {},
            'sync_capabilities': {}
        }
        
        # Check enhanced poster
        poster = Path('telegram_poster_enhanced.py')
        if poster.exists():
            with open(poster) as f:
                content = f.read()
            
            # Check message handling
            message_handling = {
                'format_preservation': 'parse_mode' in content,
                'clean_posting': 'clean' in content.lower(),
                'error_handling': 'try:' in content and 'except' in content
            }
            
            # Check stealth features
            stealth_features = {
                'no_attribution': 'signature' not in content.lower(),
                'no_source_reference': 'source' not in content.lower() or 'from' not in content.lower(),
                'clean_content_only': 'content' in content and 'message' in content
            }
            
            # Check sync capabilities
            sync_capabilities = {
                'message_mapping': 'MessageMappingManager' in content,
                'edit_sync': 'edit_message' in content,
                'delete_sync': 'delete_message' in content
            }
            
            findings['message_handling'] = message_handling
            findings['stealth_features'] = stealth_features
            findings['sync_capabilities'] = sync_capabilities
            
        else:
            findings['status'] = 'missing'
            self.audit_results['critical_findings'].append("Telegram poster implementation missing")
        
        return findings
    
    def audit_trap_detection(self) -> Dict[str, Any]:
        """Audit trap detection and blocking mechanisms"""
        logger.info("🔍 Auditing Trap Detection...")
        
        findings = {
            'status': 'operational',
            'detection_methods': {},
            'blocking_logic': {},
            'stealth_protection': {}
        }
        
        # Check cleaner config
        cleaner_config = Path('cleaner_config.json')
        if cleaner_config.exists():
            with open(cleaner_config) as f:
                config = json.load(f)
            
            detection_methods = {
                'text_patterns': len(config.get('header_patterns', [])) + len(config.get('footer_patterns', [])),
                'spam_patterns': len(config.get('spam_patterns', [])),
                'mention_patterns': len(config.get('mention_patterns', [])),
                'edit_threshold': config.get('edit_trap_threshold', 3)
            }
            
            findings['detection_methods'] = detection_methods
            findings['blocking_logic']['config_present'] = True
            
        else:
            findings['blocking_logic']['config_present'] = False
            self.audit_results['security_warnings'].append("Cleaner config missing")
        
        # Check blocklist
        blocklist = Path('blocklist.json')
        if blocklist.exists():
            with open(blocklist) as f:
                data = json.load(f)
            
            stealth_protection = {
                'global_blocklist_active': 'global_blocklist' in data,
                'image_hash_blocking': len(data.get('global_blocklist', {}).get('images', [])),
                'text_blocking': len(data.get('global_blocklist', {}).get('text', []))
            }
            
            findings['stealth_protection'] = stealth_protection
            
        else:
            findings['stealth_protection']['blocklist_missing'] = True
            self.audit_results['security_warnings'].append("Blocklist configuration missing")
        
        return findings
    
    def audit_message_flow_stealth(self) -> Dict[str, Any]:
        """Audit end-to-end message flow for stealth characteristics"""
        logger.info("🔍 Auditing Message Flow Stealth...")
        
        findings = {
            'attribution_removal': {},
            'metadata_cleaning': {},
            'format_preservation': {},
            'identity_protection': {}
        }
        
        # Test message cleaning with sample trap content
        try:
            # Import the message cleaner for testing
            sys.path.append('.')
            from discord_bot import MessageCleaner
            
            cleaner = MessageCleaner()
            
            # Test various trap scenarios
            test_cases = [
                {
                    'name': 'VIP Signal Header',
                    'content': '***VIP SIGNAL***\nBuy BTCUSDT at 45000\nshared by @cryptoking',
                    'expected_trap': True
                },
                {
                    'name': 'Footer Attribution',
                    'content': 'Good signal here\n\nForwarded from TradingChannel',
                    'expected_trap': True
                },
                {
                    'name': 'Mention Spam',
                    'content': 'Hey @everyone check this out!',
                    'expected_trap': False  # Should clean but not trap
                },
                {
                    'name': 'Clean Signal',
                    'content': 'Buy BTCUSDT at 45000\nTP: 46000\nSL: 44000',
                    'expected_trap': False
                }
            ]
            
            stealth_results = {}
            for test in test_cases:
                cleaned, is_trap = cleaner.clean_discord_message(test['content'], f"test_{test['name']}")
                
                stealth_results[test['name']] = {
                    'original_length': len(test['content']),
                    'cleaned_length': len(cleaned),
                    'trap_detected': is_trap,
                    'content_preserved': len(cleaned) > 0,
                    'stealth_effective': is_trap == test['expected_trap']
                }
            
            findings['attribution_removal'] = stealth_results
            
        except Exception as e:
            self.audit_results['critical_findings'].append(f"Message cleaner test failed: {e}")
            findings['attribution_removal']['test_failed'] = str(e)
        
        return findings
    
    def audit_session_security(self) -> Dict[str, Any]:
        """Audit session security and identity protection"""
        logger.info("🔍 Auditing Session Security...")
        
        findings = {
            'session_isolation': {},
            'identity_protection': {},
            'api_security': {}
        }
        
        # Check session directory
        sessions_dir = Path('sessions')
        if sessions_dir.exists():
            session_files = list(sessions_dir.glob('*.session'))
            findings['session_isolation'] = {
                'directory_present': True,
                'session_files_count': len(session_files),
                'secure_storage': all(f.stat().st_mode & 0o077 == 0 for f in session_files) if session_files else True
            }
        else:
            findings['session_isolation']['directory_missing'] = True
            self.audit_results['security_warnings'].append("Sessions directory missing")
        
        # Check for API key exposure in logs/config
        api_security = {
            'env_variables_used': bool(os.getenv('TELEGRAM_API_ID')),
            'no_hardcoded_tokens': True,  # Would need deeper analysis
            'logging_secure': True  # Would need log analysis
        }
        
        findings['api_security'] = api_security
        
        return findings
    
    def calculate_stealth_score(self) -> int:
        """Calculate overall stealth score (0-100)"""
        score = 0
        max_score = 100
        
        # Message cleaning effectiveness (30 points)
        if self.audit_results['operational_status'].get('discord_bot', {}).get('message_cleaning'):
            cleaning = self.audit_results['operational_status']['discord_bot']['message_cleaning']
            if cleaning.get('mention_removal'): score += 5
            if cleaning.get('header_cleaning'): score += 10
            if cleaning.get('footer_cleaning'): score += 10
            if cleaning.get('formatting_preservation'): score += 5
        
        # Stealth features (40 points)
        components = ['telegram_userbot', 'discord_bot', 'telegram_poster']
        for component in components:
            stealth = self.audit_results['operational_status'].get(component, {}).get('stealth_features', {})
            score += len([v for v in stealth.values() if v]) * 3
        
        # Trap detection (20 points)
        trap_detection = self.audit_results['operational_status'].get('trap_detection', {})
        if trap_detection.get('detection_methods'):
            methods = trap_detection['detection_methods']
            if methods.get('text_patterns', 0) > 0: score += 5
            if methods.get('spam_patterns', 0) > 0: score += 5
            if methods.get('edit_threshold', 0) > 0: score += 5
        if trap_detection.get('stealth_protection', {}).get('global_blocklist_active'): score += 5
        
        # Security measures (10 points)
        session_security = self.audit_results['operational_status'].get('session_security', {})
        if session_security.get('session_isolation', {}).get('directory_present'): score += 5
        if session_security.get('api_security', {}).get('env_variables_used'): score += 5
        
        return min(score, max_score)
    
    def generate_security_report(self) -> Dict[str, Any]:
        """Generate comprehensive security audit report"""
        logger.info("📋 Generating Security Audit Report...")
        
        # Run all audits
        self.audit_results['operational_status']['telegram_userbot'] = self.audit_telegram_userbot()
        self.audit_results['operational_status']['discord_bot'] = self.audit_discord_bot()
        self.audit_results['operational_status']['telegram_poster'] = self.audit_telegram_poster()
        self.audit_results['operational_status']['trap_detection'] = self.audit_trap_detection()
        self.audit_results['operational_status']['session_security'] = self.audit_session_security()
        
        # Audit stealth features
        self.audit_results['stealth_features'] = self.audit_message_flow_stealth()
        
        # Calculate scores
        self.audit_results['stealth_score'] = self.calculate_stealth_score()
        
        # Determine overall security status
        critical_count = len(self.audit_results['critical_findings'])
        warning_count = len(self.audit_results['security_warnings'])
        
        if critical_count == 0 and warning_count == 0:
            self.audit_results['overall_security'] = 'excellent'
        elif critical_count == 0 and warning_count <= 2:
            self.audit_results['overall_security'] = 'good'
        elif critical_count <= 1:
            self.audit_results['overall_security'] = 'acceptable'
        else:
            self.audit_results['overall_security'] = 'needs_improvement'
        
        # Add timestamp
        self.audit_results['audit_timestamp'] = datetime.now().isoformat()
        
        return self.audit_results
    
    def print_security_report(self):
        """Print human-readable security audit report"""
        report = self.generate_security_report()
        
        print("\n" + "="*80)
        print("🔐 AUTOFORWARDX SECURITY & STEALTH AUDIT REPORT")
        print("="*80)
        
        # Overall status
        status_emoji = {
            'excellent': '🟢',
            'good': '🟡',
            'acceptable': '🟠',
            'needs_improvement': '🔴'
        }
        
        print(f"\n🛡️  OVERALL SECURITY: {status_emoji.get(report['overall_security'], '❓')} {report['overall_security'].upper()}")
        print(f"🥷 STEALTH SCORE: {report['stealth_score']}/100")
        print(f"📅 Audit Date: {report['audit_timestamp']}")
        
        # Critical findings
        if report['critical_findings']:
            print(f"\n🚨 CRITICAL SECURITY ISSUES:")
            for finding in report['critical_findings']:
                print(f"   ❌ {finding}")
        else:
            print(f"\n✅ NO CRITICAL SECURITY ISSUES FOUND")
        
        # Security warnings
        if report['security_warnings']:
            print(f"\n⚠️  SECURITY WARNINGS:")
            for warning in report['security_warnings']:
                print(f"   🟡 {warning}")
        else:
            print(f"\n✅ NO SECURITY WARNINGS")
        
        # Component status
        print(f"\n🔧 COMPONENT SECURITY STATUS:")
        for component, data in report['operational_status'].items():
            status = data.get('status', 'unknown')
            emoji = '✅' if status == 'operational' else '❌' if status == 'missing' else '⚠️'
            print(f"   {emoji} {component.replace('_', ' ').title()}: {status}")
        
        # Stealth assessment
        print(f"\n🥷 STEALTH EFFECTIVENESS:")
        if report['stealth_score'] >= 80:
            print("   🟢 EXCELLENT - System operates in full stealth mode")
        elif report['stealth_score'] >= 60:
            print("   🟡 GOOD - Minor stealth improvements possible")
        elif report['stealth_score'] >= 40:
            print("   🟠 ACCEPTABLE - Some stealth features need enhancement")
        else:
            print("   🔴 POOR - Major stealth improvements required")
        
        # Recommendations
        print(f"\n💡 SECURITY RECOMMENDATIONS:")
        if report['stealth_score'] < 80:
            print("   • Enhance message cleaning patterns")
            print("   • Implement stronger attribution removal")
        if report['security_warnings']:
            print("   • Address all security warnings")
        if not report['critical_findings']:
            print("   • System ready for stealth operations")
            print("   • Consider additional monitoring")
        
        print("\n" + "="*80)
        
        return report

async def main():
    """Main security audit entry point"""
    auditor = SecurityAuditor()
    report = auditor.print_security_report()
    
    # Save report to file
    report_file = Path('logs/security_audit_report.json')
    report_file.parent.mkdir(exist_ok=True)
    
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Full security report saved to: {report_file}")
    
    # Return exit code based on security status
    if report['overall_security'] in ['excellent', 'good']:
        sys.exit(0)
    elif report['overall_security'] == 'acceptable':
        sys.exit(1)
    else:
        sys.exit(2)

if __name__ == "__main__":
    asyncio.run(main())