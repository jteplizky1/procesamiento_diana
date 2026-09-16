"""Bounded, sequential retries; no duplicate requests launched in parallel."""
import time
import urllib.error
from contextvars import ContextVar
from http.client import IncompleteRead

RETRY_ATTEMPT = ContextVar('text_retry_attempt', default=0)


class OutputLimitError(ValueError):
    pass


class ModelInterruptedError(ValueError):
    pass


class StopRequested(Exception):
    pass


def http_status(error):
    while error:
        if isinstance(error, urllib.error.HTTPError):
            return error.code
        error = error.__cause__
    return None


def transient(error):
    status = http_status(error)
    if status is not None:
        return status in (408, 429, 500, 502, 503, 504)
    while error:
        if isinstance(error, (TimeoutError, ConnectionError, urllib.error.URLError,
                              OutputLimitError, ModelInterruptedError, IncompleteRead, EOFError)):
            return True
        error = error.__cause__
    return False


def run_with_retries(operation, batch_size, notify, stopped, sleep=time.sleep):
    for attempt in range(3):
        if stopped():
            raise StopRequested()
        size = max(1, batch_size // (2 ** attempt))
        notify(phase=f'Intento {attempt+1}/3 · hasta {size} textos', attempt=attempt+1, effective_batch_size=size, retry_in=0)
        token = RETRY_ATTEMPT.set(attempt)
        try:
            return operation(size)
        except Exception as error:
            if not transient(error) or attempt == 2:
                raise
            for remaining in range(30 * (attempt+1), 0, -1):
                if stopped():
                    raise StopRequested()
                notify(phase=f'Espera antes del reintento: {remaining} s', retry_in=remaining)
                sleep(1)
        finally:
            RETRY_ATTEMPT.reset(token)
