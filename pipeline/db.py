import json
import logging
import os
from pathlib import Path

import redis

logger = logging.getLogger(__name__)


class RedisDB:
    def __init__(self, host="localhost", port=6379, db=0):
        url = os.getenv("REDIS_URL")
        host = os.getenv("REDIS_HOST", host)
        port = int(os.getenv("REDIS_PORT", port))
        db = int(os.getenv("REDIS_DB", db))
        self._fallback_file = Path(
            os.getenv(
                "STATE_STORE_FILE",
                Path(__file__).resolve().parents[1] / "data" / "state_store.json",
            )
        )

        try:
            if url:
                self.client = redis.from_url(url, decode_responses=True)
            else:
                self.client = redis.Redis(
                    host=host, port=port, db=db, decode_responses=True
                )
            self.client.ping()
            self._fallback = None
        except redis.RedisError as exc:
            logger.warning("Redis unavailable (%s). Using local JSON store.", exc)
            self.client = None
            self._fallback = self._load_fallback()

    def set(self, key, value):
        if self.client:
            self.client.set(key, json.dumps(value))
        else:
            self._fallback[key] = value
            self._persist_fallback()

    def get(self, key):
        if self.client:
            data = self.client.get(key)
            return json.loads(data) if data else None
        return self._fallback.get(key)

    def delete(self, key):
        if self.client:
            self.client.delete(key)
        else:
            if key in self._fallback:
                self._fallback.pop(key)
                self._persist_fallback()

    def keys(self, pattern="*"):
        if self.client:
            return self.client.keys(pattern)
        return list(self._fallback.keys())

    def flush(self):
        if self.client:
            self.client.flushdb()
        else:
            self._fallback.clear()
            self._persist_fallback()

    def _load_fallback(self):
        if self._fallback_file.exists():
            try:
                with self._fallback_file.open("r") as fh:
                    data = json.load(fh)
                    if isinstance(data, dict):
                        return data
                    logger.warning(
                        "State store file %s contains %s, not dict. Resetting.",
                        self._fallback_file,
                        type(data).__name__,
                    )
            except json.JSONDecodeError:
                logger.warning(
                    "State store file %s is corrupted. Starting fresh.",
                    self._fallback_file,
                )
        return {}

    def _persist_fallback(self):
        self._fallback_file.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self._fallback_file.with_suffix(".tmp")
        with tmp_path.open("w") as fh:
            json.dump(self._fallback, fh)
        tmp_path.replace(self._fallback_file)


db = RedisDB()
