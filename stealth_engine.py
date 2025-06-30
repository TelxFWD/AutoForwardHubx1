#!/usr/bin/env python3
"""
AutoForwardX Stealth Engine
Advanced message sanitization and anti-fingerprinting system
Implements 100/100 stealth capabilities with complete traceability elimination
"""

import re
import io
import json
import random
import logging
import hashlib
from typing import Dict, List, Optional, Any, Tuple, Union
from pathlib import Path
from PIL import Image, ExifTags
import requests
from datetime import datetime

# Setup dedicated stealth logging
stealth_logger = logging.getLogger('stealth_engine')
stealth_handler = logging.FileHandler('logs/stealth_audit.log')
stealth_handler.setFormatter(logging.Formatter('%(asctime)s - STEALTH - %(levelname)s - %(message)s'))
stealth_logger.addHandler(stealth_handler)
stealth_logger.setLevel(logging.INFO)

class StealthEngine:
    """Advanced stealth engine for complete message sanitization"""
    
    def __init__(self, config_file: str = "stealth_config.json"):
        self.config_file = Path(config_file)
        self.config = self._load_config()
        self.invisible_chars = ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff']
        stealth_logger.info("Stealth Engine initialized with advanced anti-fingerprinting")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load stealth configuration"""
        default_config = {
            "fingerprint_normalization": {
                "normalize_punctuation": True,
                "normalize_emojis": True,
                "remove_zero_width": True,
                "normalize_stylized_traps": True,
                "preserve_formatting": True
            },
            "image_processing": {
                "strip_exif": True,
                "recompress_quality": 85,
                "format_conversion": "auto"
            },
            "invisible_watermark": {
                "enabled": False,
                "intensity": 1,
                "high_risk_channels": []
            },
            "ai_rewriter": {
                "enabled": False,
                "api_provider": "openai",
                "neutralize_language": True,
                "preserve_intent": True
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                stealth_logger.info(f"Loaded stealth config from {self.config_file}")
                return {**default_config, **config}
            except Exception as e:
                stealth_logger.warning(f"Failed to load config: {e}, using defaults")
        else:
            # Create default config file
            with open(self.config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            stealth_logger.info(f"Created default stealth config at {self.config_file}")
        
        return default_config
    
    def normalize_message_fingerprint(self, text: str, channel_id: str = None) -> str:
        """
        Complete fingerprint normalization to eliminate traceability
        
        Args:
            text: Original message text
            channel_id: Optional channel ID for risk assessment
            
        Returns:
            Normalized text with all fingerprints removed
        """
        if not text:
            return text
        
        original_text = text
        stealth_logger.debug(f"Normalizing fingerprint for text length: {len(text)}")
        
        # Step 1: Remove zero-width characters
        if self.config["fingerprint_normalization"]["remove_zero_width"]:
            for char in self.invisible_chars:
                text = text.replace(char, '')
        
        # Step 2: Normalize repeated punctuation
        if self.config["fingerprint_normalization"]["normalize_punctuation"]:
            # Reduce repeated punctuation: !!! → !, ??? → ?
            text = re.sub(r'[!]{2,}', '!', text)
            text = re.sub(r'[?]{2,}', '?', text)
            text = re.sub(r'[.]{3,}', '...', text)  # Keep ellipsis pattern
            text = re.sub(r'[,]{2,}', ',', text)
            text = re.sub(r'[;]{2,}', ';', text)
        
        # Step 3: Normalize emoji spam
        if self.config["fingerprint_normalization"]["normalize_emojis"]:
            # Common emoji patterns
            emoji_patterns = [
                (r'🔥{2,}', '🔥'),
                (r'💯{2,}', '💯'),
                (r'⚡{2,}', '⚡'),
                (r'🚀{2,}', '🚀'),
                (r'💰{2,}', '💰'),
                (r'📈{2,}', '📈'),
                (r'📊{2,}', '📊'),
                (r'⭐{2,}', '⭐'),
                (r'✅{2,}', '✅'),
                (r'❌{2,}', '❌')
            ]
            
            for pattern, replacement in emoji_patterns:
                text = re.sub(pattern, replacement, text)
        
        # Step 4: Normalize stylized traps
        if self.config["fingerprint_normalization"]["normalize_stylized_traps"]:
            # Remove decorative patterns around headers
            patterns = [
                (r'\*{3,}\s*(.+?)\s*\*{3,}', r'\1'),  # *** TEXT *** → TEXT
                (r'={3,}\s*(.+?)\s*={3,}', r'\1'),    # === TEXT === → TEXT
                (r'-{3,}\s*(.+?)\s*-{3,}', r'\1'),    # --- TEXT --- → TEXT
                (r'#{3,}\s*(.+?)\s*#{3,}', r'\1'),    # ### TEXT ### → TEXT
                (r'▪{2,}\s*(.+?)\s*▪{2,}', r'\1'),    # ▪▪ TEXT ▪▪ → TEXT
                (r'•{2,}\s*(.+?)\s*•{2,}', r'\1'),    # •• TEXT •• → TEXT
            ]
            
            for pattern, replacement in patterns:
                text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        
        # Step 5: Normalize whitespace (preserve formatting)
        if self.config["fingerprint_normalization"]["preserve_formatting"]:
            # Only normalize excessive whitespace, keep intentional formatting
            text = re.sub(r'[ \t]{2,}', ' ', text)  # Multiple spaces/tabs → single space
            text = re.sub(r'\n{3,}', '\n\n', text)  # Multiple newlines → double newline
        else:
            # Aggressive whitespace normalization
            text = re.sub(r'\s+', ' ', text)
            text = text.strip()
        
        # Step 6: Remove common trap indicators
        trap_indicators = [
            r'\b(VIP|PREMIUM|EXCLUSIVE)\s+(SIGNAL|ENTRY|ALERT)\b',
            r'\b(SHARED|FORWARDED)\s+BY\b.*$',
            r'\b(AUTO|BOT|COPY)\s+(TRADING|SIGNAL|BOT)\b.*$',
            r'\bv\d+\.\d+\b$',  # Version numbers at end
            r'\b(CHANNEL|GROUP)\s*:\s*@\w+\b'
        ]
        
        for pattern in trap_indicators:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)
        
        # Log normalization results
        if text != original_text:
            stealth_logger.info(f"Fingerprint normalized: {len(original_text)} → {len(text)} chars")
            stealth_logger.debug(f"Changes applied to message ID")
        
        return text.strip()
    
    def recompress_image(self, image_bytes: bytes, quality: int = None) -> bytes:
        """
        Strip metadata and recompress image to eliminate fingerprints
        
        Args:
            image_bytes: Original image bytes
            quality: JPEG quality (default from config)
            
        Returns:
            Recompressed image bytes without metadata
        """
        if not image_bytes:
            return image_bytes
        
        quality = quality or self.config["image_processing"]["recompress_quality"]
        stealth_logger.info(f"Recompressing image: {len(image_bytes)} bytes")
        
        try:
            # Open image from bytes
            original_image = Image.open(io.BytesIO(image_bytes))
            
            # Log original metadata if present
            if hasattr(original_image, '_getexif') and original_image._getexif():
                exif_data = original_image._getexif()
                stealth_logger.info(f"Stripping EXIF data: {len(exif_data)} entries")
            
            # Convert to RGB if necessary (removes alpha channel and ensures compatibility)
            if original_image.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparent images
                background = Image.new('RGB', original_image.size, (255, 255, 255))
                if original_image.mode == 'P':
                    original_image = original_image.convert('RGBA')
                background.paste(original_image, mask=original_image.split()[-1] if original_image.mode == 'RGBA' else None)
                original_image = background
            elif original_image.mode != 'RGB':
                original_image = original_image.convert('RGB')
            
            # Create new image buffer
            output_buffer = io.BytesIO()
            
            # Save without metadata
            original_image.save(
                output_buffer,
                format='JPEG',
                quality=quality,
                optimize=True,
                exif=b''  # Remove all EXIF data
            )
            
            recompressed_bytes = output_buffer.getvalue()
            output_buffer.close()
            
            stealth_logger.info(f"Image recompressed: {len(image_bytes)} → {len(recompressed_bytes)} bytes")
            return recompressed_bytes
            
        except Exception as e:
            stealth_logger.error(f"Image recompression failed: {e}")
            return image_bytes  # Return original if processing fails
    
    def inject_invisible_noise(self, text: str, intensity: int = None, channel_id: str = None) -> str:
        """
        Inject invisible Unicode watermarks for anti-leak protection
        
        Args:
            text: Original text
            intensity: Number of insertions per sentence
            channel_id: Channel ID to check if high-risk
            
        Returns:
            Text with invisible noise injected
        """
        if not self.config["invisible_watermark"]["enabled"]:
            return text
        
        intensity = intensity or self.config["invisible_watermark"]["intensity"]
        
        # Check if channel is high-risk
        high_risk_channels = self.config["invisible_watermark"]["high_risk_channels"]
        if channel_id and high_risk_channels and channel_id not in high_risk_channels:
            return text
        
        if not text or intensity <= 0:
            return text
        
        stealth_logger.info(f"Injecting invisible noise: intensity={intensity}")
        
        # Split into sentences
        sentences = re.split(r'[.!?]+', text)
        watermarked_sentences = []
        
        for sentence in sentences:
            if len(sentence.strip()) == 0:
                watermarked_sentences.append(sentence)
                continue
            
            words = sentence.split()
            if len(words) <= 1:
                watermarked_sentences.append(sentence)
                continue
            
            # Inject invisible characters between words
            for _ in range(intensity):
                if len(words) > 1:
                    insert_pos = random.randint(1, len(words) - 1)
                    invisible_char = random.choice(self.invisible_chars)
                    words[insert_pos] = invisible_char + words[insert_pos]
            
            watermarked_sentences.append(' '.join(words))
        
        # Rejoin sentences
        watermarked_text = '.'.join(watermarked_sentences)
        if watermarked_text != text:
            stealth_logger.debug(f"Invisible noise injected: {len(text)} → {len(watermarked_text)} chars")
        
        return watermarked_text
    
    def rewrite_caption_with_ai(self, text: str, api_key: str = None) -> str:
        """
        AI-powered caption rewriting for maximum stealth
        
        Args:
            text: Original caption
            api_key: API key for AI service
            
        Returns:
            Rewritten neutral caption
        """
        if not self.config["ai_rewriter"]["enabled"] or not text:
            return text
        
        stealth_logger.info(f"AI rewriting caption: {len(text)} chars")
        
        try:
            # For now, implement rule-based rewriting
            # TODO: Integrate with OpenAI/Claude API when available
            
            # Remove obvious giveaways
            rewritten = text
            
            # Remove VIP/Premium indicators
            rewritten = re.sub(r'\b(VIP|PREMIUM|EXCLUSIVE)\s*', '', rewritten, flags=re.IGNORECASE)
            
            # Remove attribution
            rewritten = re.sub(r'\b(SHARED|FORWARDED)\s+BY\s+.*$', '', rewritten, flags=re.IGNORECASE | re.MULTILINE)
            
            # Remove bot signatures
            rewritten = re.sub(r'\b(AUTO|COPY|BOT)\s+(TRADING|SIGNAL).*$', '', rewritten, flags=re.IGNORECASE | re.MULTILINE)
            
            # Normalize promotional language
            replacements = {
                r'\b(AMAZING|INCREDIBLE|FANTASTIC)\s+': '',
                r'\b(DON\'T MISS|URGENT|HURRY)\b': '',
                r'\b(GUARANTEED|100%|SURE)\s+': '',
                r'🔥\s*(ENTRY|SIGNAL)\s*🔥': 'Entry',
            }
            
            for pattern, replacement in replacements.items():
                rewritten = re.sub(pattern, replacement, rewritten, flags=re.IGNORECASE)
            
            # Clean up extra whitespace
            rewritten = re.sub(r'\s+', ' ', rewritten).strip()
            
            if rewritten != text:
                stealth_logger.info(f"Caption rewritten: {len(text)} → {len(rewritten)} chars")
            
            return rewritten
            
        except Exception as e:
            stealth_logger.error(f"AI caption rewriting failed: {e}")
            return text
    
    def process_message_complete(self, text: str, image_bytes: bytes = None, 
                                channel_id: str = None, enable_watermark: bool = False) -> Tuple[str, bytes]:
        """
        Complete stealth processing pipeline
        
        Args:
            text: Message text
            image_bytes: Optional image data
            channel_id: Channel identifier
            enable_watermark: Force watermark injection
            
        Returns:
            Tuple of (processed_text, processed_image_bytes)
        """
        stealth_logger.info(f"Starting complete stealth processing for channel: {channel_id}")
        
        processed_text = text
        processed_image = image_bytes
        
        # Step 1: Normalize fingerprints
        if processed_text:
            processed_text = self.normalize_message_fingerprint(processed_text, channel_id)
        
        # Step 2: AI rewriting if enabled
        if processed_text and self.config["ai_rewriter"]["enabled"]:
            processed_text = self.rewrite_caption_with_ai(processed_text)
        
        # Step 3: Invisible watermark if needed
        if processed_text and (enable_watermark or self.config["invisible_watermark"]["enabled"]):
            processed_text = self.inject_invisible_noise(processed_text, channel_id=channel_id)
        
        # Step 4: Process image if present
        if processed_image:
            processed_image = self.recompress_image(processed_image)
        
        stealth_logger.info("Complete stealth processing finished")
        return processed_text, processed_image
    
    def verify_stealth_compliance(self, text: str, image_bytes: bytes = None) -> Dict[str, Any]:
        """
        Verify message meets stealth compliance standards
        
        Args:
            text: Processed text
            image_bytes: Processed image
            
        Returns:
            Compliance report
        """
        compliance = {
            'overall_score': 0,
            'text_compliance': {},
            'image_compliance': {},
            'recommendations': []
        }
        
        # Text compliance checks
        if text:
            text_score = 100
            
            # Check for attribution indicators
            attribution_patterns = [
                r'\b(shared|forwarded)\s+by\b',
                r'\b(channel|group)\s*:\s*@',
                r'\bvia\s+@\w+',
                r'\bt\.me/',
                r'\b(copy|auto|bot)\s+(trading|signal)'
            ]
            
            for pattern in attribution_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    text_score -= 15
                    compliance['recommendations'].append(f"Remove attribution pattern: {pattern}")
            
            # Check for promotional language
            promo_patterns = [
                r'\b(vip|premium|exclusive)\s+(signal|entry)',
                r'🔥{2,}',
                r'\b(amazing|incredible|guaranteed)\b'
            ]
            
            for pattern in promo_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    text_score -= 10
                    compliance['recommendations'].append(f"Neutralize promotional language: {pattern}")
            
            # Check for invisible characters (should be minimal if watermarked)
            invisible_count = sum(text.count(char) for char in self.invisible_chars)
            if invisible_count > len(text) * 0.01:  # More than 1% invisible chars
                text_score -= 5
                compliance['recommendations'].append("Excessive invisible characters detected")
            
            compliance['text_compliance'] = {
                'score': max(0, text_score),
                'attribution_free': text_score >= 85,
                'promotion_neutral': text_score >= 90,
                'invisible_chars': invisible_count
            }
        
        # Image compliance checks
        if image_bytes:
            image_score = 100
            
            try:
                # Check for EXIF data
                image = Image.open(io.BytesIO(image_bytes))
                if hasattr(image, '_getexif') and image._getexif():
                    image_score -= 50
                    compliance['recommendations'].append("EXIF data still present")
                
                compliance['image_compliance'] = {
                    'score': image_score,
                    'metadata_free': image_score >= 50,
                    'size_bytes': len(image_bytes)
                }
            except Exception as e:
                compliance['image_compliance'] = {
                    'score': 0,
                    'error': str(e)
                }
        
        # Calculate overall score
        scores = []
        if text:
            scores.append(compliance['text_compliance']['score'])
        if image_bytes:
            scores.append(compliance['image_compliance']['score'])
        
        compliance['overall_score'] = sum(scores) / len(scores) if scores else 0
        
        stealth_logger.info(f"Stealth compliance verified: {compliance['overall_score']}/100")
        return compliance

# Convenience functions for integration
def process_for_telegram(text: str, image_bytes: bytes = None, channel_id: str = None) -> Tuple[str, bytes]:
    """Process message for Telegram with complete stealth"""
    engine = StealthEngine()
    return engine.process_message_complete(text, image_bytes, channel_id)

def verify_message_stealth(text: str, image_bytes: bytes = None) -> Dict[str, Any]:
    """Verify message stealth compliance"""
    engine = StealthEngine()
    return engine.verify_stealth_compliance(text, image_bytes)

# Initialize default engine instance
default_engine = StealthEngine()

# Export main functions
normalize_message_fingerprint = default_engine.normalize_message_fingerprint
recompress_image = default_engine.recompress_image
inject_invisible_noise = default_engine.inject_invisible_noise
rewrite_caption_with_ai = default_engine.rewrite_caption_with_ai