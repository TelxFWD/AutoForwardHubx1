"""
Structured logging configuration for AutoForwardX
Provides consistent logging across all components
"""

import logging
import logging.handlers
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured logging with JSON output"""
    
    def __init__(self, include_fields: Optional[list] = None):
        super().__init__()
        self.include_fields = include_fields or [
            'timestamp', 'level', 'component', 'message', 'details'
        ]
    
    def format(self, record):
        # Create structured log entry
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'component': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
                          'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                          'thread', 'threadName', 'processName', 'process', 'getMessage']:
                log_entry[key] = value
        
        return json.dumps(log_entry, ensure_ascii=False)

class ComponentLogger:
    """Logger wrapper for individual components with context"""
    
    def __init__(self, component_name: str, context: Optional[Dict[str, Any]] = None):
        self.component_name = component_name
        self.context = context or {}
        self.logger = logging.getLogger(component_name)
    
    def _add_context(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Add component context to log entry"""
        context = self.context.copy()
        if extra:
            context.update(extra)
        return context
    
    def debug(self, message: str, **kwargs):
        extra = self._add_context(kwargs)
        self.logger.debug(message, extra=extra)
    
    def info(self, message: str, **kwargs):
        extra = self._add_context(kwargs)
        self.logger.info(message, extra=extra)
    
    def warning(self, message: str, **kwargs):
        extra = self._add_context(kwargs)
        self.logger.warning(message, extra=extra)
    
    def error(self, message: str, **kwargs):
        extra = self._add_context(kwargs)
        self.logger.error(message, extra=extra)
    
    def critical(self, message: str, **kwargs):
        extra = self._add_context(kwargs)
        self.logger.critical(message, extra=extra)

class LogManager:
    """Central log management for AutoForwardX"""
    
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        self.loggers: Dict[str, ComponentLogger] = {}
        self._setup_root_logger()
    
    def _setup_root_logger(self):
        """Setup root logger configuration"""
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        
        # Clear existing handlers
        root_logger.handlers.clear()
        
        # Console handler with simple format
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)
        
        # File handler with structured format
        file_handler = logging.handlers.RotatingFileHandler(
            self.log_dir / 'autoforwardx.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(file_handler)
    
    def get_logger(self, component_name: str, context: Optional[Dict[str, Any]] = None) -> ComponentLogger:
        """Get or create a component logger"""
        if component_name not in self.loggers:
            # Create component-specific file handler
            component_handler = logging.handlers.RotatingFileHandler(
                self.log_dir / f'{component_name}.log',
                maxBytes=5*1024*1024,  # 5MB
                backupCount=3
            )
            component_handler.setLevel(logging.DEBUG)
            component_handler.setFormatter(StructuredFormatter())
            
            # Setup component logger
            logger = logging.getLogger(component_name)
            logger.addHandler(component_handler)
            logger.setLevel(logging.DEBUG)
            
            self.loggers[component_name] = ComponentLogger(component_name, context)
        
        return self.loggers[component_name]
    
    def create_activity_log(self, activity_type: str, message: str, details: str, 
                           severity: str = "info", component: str = "system") -> Dict[str, Any]:
        """Create activity log entry for database/API"""
        activity = {
            'type': activity_type,
            'message': message,
            'details': details,
            'severity': severity,
            'component': component,
            'timestamp': datetime.now().isoformat()
        }
        
        # Log to component logger
        logger = self.get_logger(component)
        log_method = getattr(logger, severity, logger.info)
        log_method(message, activity_type=activity_type, details=details)
        
        return activity
    
    def log_telegram_operation(self, operation: str, channel: str, success: bool, 
                             details: Optional[str] = None, pair_name: Optional[str] = None):
        """Log Telegram operations with context"""
        logger = self.get_logger('telegram_operations')
        level = 'info' if success else 'error'
        
        log_method = getattr(logger, level)
        log_method(
            f"Telegram {operation}: {channel}",
            operation=operation,
            channel=channel,
            success=success,
            details=details,
            pair_name=pair_name
        )
    
    def log_discord_operation(self, operation: str, channel_id: str, success: bool,
                            details: Optional[str] = None, pair_name: Optional[str] = None):
        """Log Discord operations with context"""
        logger = self.get_logger('discord_operations')
        level = 'info' if success else 'error'
        
        log_method = getattr(logger, level)
        log_method(
            f"Discord {operation}: {channel_id}",
            operation=operation,
            channel_id=channel_id,
            success=success,
            details=details,
            pair_name=pair_name
        )
    
    def log_trap_detection(self, trap_type: str, content: str, pair_name: str, 
                          action_taken: str, confidence: float = 1.0):
        """Log trap detection events"""
        logger = self.get_logger('trap_detection')
        logger.warning(
            f"Trap detected: {trap_type}",
            trap_type=trap_type,
            content=content[:100] + "..." if len(content) > 100 else content,
            pair_name=pair_name,
            action_taken=action_taken,
            confidence=confidence
        )
    
    def log_session_operation(self, session_name: str, operation: str, success: bool,
                            details: Optional[str] = None):
        """Log session operations"""
        logger = self.get_logger('session_operations')
        level = 'info' if success else 'error'
        
        log_method = getattr(logger, level)
        log_method(
            f"Session {operation}: {session_name}",
            session_name=session_name,
            operation=operation,
            success=success,
            details=details
        )
    
    def get_recent_logs(self, component: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent log entries for monitoring"""
        logs = []
        
        if component:
            log_file = self.log_dir / f'{component}.log'
        else:
            log_file = self.log_dir / 'autoforwardx.log'
        
        if log_file.exists():
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines[-limit:]:
                        try:
                            log_entry = json.loads(line.strip())
                            logs.append(log_entry)
                        except json.JSONDecodeError:
                            # Skip non-JSON lines
                            continue
            except Exception as e:
                print(f"Error reading log file: {e}")
        
        return logs
    
    def cleanup_old_logs(self, days: int = 30):
        """Clean up log files older than specified days"""
        cutoff_time = datetime.now().timestamp() - (days * 24 * 60 * 60)
        
        for log_file in self.log_dir.glob('*.log*'):
            try:
                if log_file.stat().st_mtime < cutoff_time:
                    log_file.unlink()
                    print(f"Deleted old log file: {log_file}")
            except Exception as e:
                print(f"Error deleting log file {log_file}: {e}")

# Global log manager instance
log_manager = LogManager()

# Convenience functions
def get_logger(component_name: str, context: Optional[Dict[str, Any]] = None) -> ComponentLogger:
    """Get a component logger"""
    return log_manager.get_logger(component_name, context)

def log_activity(activity_type: str, message: str, details: str, 
                severity: str = "info", component: str = "system") -> Dict[str, Any]:
    """Log system activity"""
    return log_manager.create_activity_log(activity_type, message, details, severity, component)

# Component-specific loggers
telegram_logger = get_logger('telegram', {'subsystem': 'messaging'})
discord_logger = get_logger('discord', {'subsystem': 'messaging'})
admin_logger = get_logger('admin', {'subsystem': 'management'})
session_logger = get_logger('session', {'subsystem': 'authentication'})
trap_logger = get_logger('trap_detection', {'subsystem': 'security'})

if __name__ == "__main__":
    # Test logging system
    test_logger = get_logger('test_component')
    
    test_logger.info("Testing structured logging", test_field="test_value")
    test_logger.warning("Test warning message", error_code=404)
    test_logger.error("Test error message", stack_trace="sample stack trace")
    
    # Test activity logging
    activity = log_activity(
        'test_activity',
        'Testing activity logging',
        'This is a test activity',
        'info',
        'test_component'
    )
    print(f"Created activity: {activity}")
    
    # Test log retrieval
    recent_logs = log_manager.get_recent_logs('test_component', 5)
    print(f"Retrieved {len(recent_logs)} recent logs")
    
    print("Logging system test complete")