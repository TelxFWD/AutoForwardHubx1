"""
Retry utility for AutoForwardX
Provides decorators and functions for robust API call handling
"""

import asyncio
import logging
import functools
from typing import Callable, Any, Optional, Type, Union, Tuple
from datetime import datetime, timedelta
import random

logger = logging.getLogger(__name__)

class RetryError(Exception):
    """Raised when all retry attempts fail"""
    def __init__(self, message: str, last_exception: Exception, attempts: int):
        super().__init__(message)
        self.last_exception = last_exception
        self.attempts = attempts

def exponential_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0, jitter: bool = True) -> float:
    """Calculate exponential backoff delay with optional jitter"""
    delay = min(base_delay * (2 ** attempt), max_delay)
    if jitter:
        delay *= (0.5 + random.random() * 0.5)  # Add 0-50% jitter
    return delay

def should_retry(exception: Exception, retry_exceptions: Tuple[Type[Exception], ...]) -> bool:
    """Check if exception should trigger a retry"""
    return any(isinstance(exception, exc_type) for exc_type in retry_exceptions)

def retry_async(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    retry_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    backoff_func: Callable[[int], float] = None,
    on_retry: Optional[Callable[[Exception, int], None]] = None
):
    """
    Async retry decorator with exponential backoff
    
    Args:
        max_attempts: Maximum number of attempts (including initial)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        retry_exceptions: Tuple of exception types that should trigger retry
        backoff_func: Custom backoff function
        on_retry: Callback function called on each retry
    """
    if backoff_func is None:
        backoff_func = lambda attempt: exponential_backoff(attempt, base_delay, max_delay)
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # Check if we should retry this exception
                    if not should_retry(e, retry_exceptions):
                        logger.error(f"Non-retryable error in {func.__name__}: {e}")
                        raise e
                    
                    # Don't wait after the last attempt
                    if attempt == max_attempts - 1:
                        break
                    
                    delay = backoff_func(attempt)
                    
                    logger.warning(
                        f"Attempt {attempt + 1}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.2f}s"
                    )
                    
                    if on_retry:
                        on_retry(e, attempt + 1)
                    
                    await asyncio.sleep(delay)
            
            # All attempts failed
            error_msg = f"All {max_attempts} attempts failed for {func.__name__}"
            logger.error(f"{error_msg}. Last error: {last_exception}")
            raise RetryError(error_msg, last_exception, max_attempts)
        
        return wrapper
    return decorator

def retry_sync(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    retry_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    backoff_func: Callable[[int], float] = None,
    on_retry: Optional[Callable[[Exception, int], None]] = None
):
    """
    Synchronous retry decorator with exponential backoff
    """
    if backoff_func is None:
        backoff_func = lambda attempt: exponential_backoff(attempt, base_delay, max_delay)
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import time
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    # Check if we should retry this exception
                    if not should_retry(e, retry_exceptions):
                        logger.error(f"Non-retryable error in {func.__name__}: {e}")
                        raise e
                    
                    # Don't wait after the last attempt
                    if attempt == max_attempts - 1:
                        break
                    
                    delay = backoff_func(attempt)
                    
                    logger.warning(
                        f"Attempt {attempt + 1}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.2f}s"
                    )
                    
                    if on_retry:
                        on_retry(e, attempt + 1)
                    
                    time.sleep(delay)
            
            # All attempts failed
            error_msg = f"All {max_attempts} attempts failed for {func.__name__}"
            logger.error(f"{error_msg}. Last error: {last_exception}")
            raise RetryError(error_msg, last_exception, max_attempts)
        
        return wrapper
    return decorator

# Common retry configurations
telegram_retry = retry_async(
    max_attempts=3,
    base_delay=2.0,
    max_delay=30.0,
    retry_exceptions=(
        ConnectionError,
        TimeoutError,
        OSError,  # Network errors
    )
)

discord_retry = retry_async(
    max_attempts=3,
    base_delay=1.0,
    max_delay=15.0,
    retry_exceptions=(
        ConnectionError,
        TimeoutError,
        OSError,
    )
)

# Context manager for retry operations
class RetryContext:
    """Context manager for retry operations with logging"""
    
    def __init__(self, operation_name: str, max_attempts: int = 3):
        self.operation_name = operation_name
        self.max_attempts = max_attempts
        self.attempt = 0
        self.start_time = None
    
    async def __aenter__(self):
        self.start_time = datetime.now()
        self.attempt += 1
        logger.info(f"Starting {self.operation_name} (attempt {self.attempt}/{self.max_attempts})")
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        duration = datetime.now() - self.start_time if self.start_time else timedelta(0)
        
        if exc_type is None:
            logger.info(f"Successfully completed {self.operation_name} in {duration.total_seconds():.2f}s")
        else:
            logger.warning(
                f"Failed {self.operation_name} attempt {self.attempt} after {duration.total_seconds():.2f}s: {exc_val}"
            )
        
        return False  # Don't suppress exceptions
    
    def should_retry(self, exception: Exception) -> bool:
        """Check if operation should be retried"""
        return (
            self.attempt < self.max_attempts and
            isinstance(exception, (ConnectionError, TimeoutError, OSError))
        )

# Utility functions for specific operations
async def safe_telegram_operation(operation: Callable, operation_name: str = "Telegram operation") -> Any:
    """Safely execute a Telegram operation with retry logic"""
    @telegram_retry
    async def wrapped_operation():
        try:
            return await operation()
        except Exception as e:
            logger.error(f"Error in {operation_name}: {type(e).__name__}: {e}")
            raise
    
    return await wrapped_operation()

async def safe_discord_operation(operation: Callable, operation_name: str = "Discord operation") -> Any:
    """Safely execute a Discord operation with retry logic"""
    @discord_retry
    async def wrapped_operation():
        try:
            return await operation()
        except Exception as e:
            logger.error(f"Error in {operation_name}: {type(e).__name__}: {e}")
            raise
    
    return await wrapped_operation()

# Rate limiting utility
class RateLimiter:
    """Simple rate limiter to avoid API abuse"""
    
    def __init__(self, max_calls: int, time_window: float):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
    
    async def acquire(self):
        """Wait if necessary to respect rate limits"""
        now = datetime.now()
        
        # Remove old calls outside the time window
        cutoff = now - timedelta(seconds=self.time_window)
        self.calls = [call_time for call_time in self.calls if call_time > cutoff]
        
        # Check if we need to wait
        if len(self.calls) >= self.max_calls:
            oldest_call = min(self.calls)
            wait_time = self.time_window - (now - oldest_call).total_seconds()
            if wait_time > 0:
                logger.info(f"Rate limit reached, waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
        
        # Record this call
        self.calls.append(now)

# Global rate limiters for common APIs
telegram_rate_limiter = RateLimiter(max_calls=20, time_window=60)  # 20 calls per minute
discord_rate_limiter = RateLimiter(max_calls=50, time_window=60)   # 50 calls per minute