"""Privacy-Preserving Shared Fraud Signals — Bloom filter consortium."""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import math
import struct
from typing import Dict, List, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


class BloomFilter:
    """A simple Bloom filter backed by a bytearray.

    Uses SHA-256 based hashing with a per-index salt to derive
    ``hash_count`` independent bit positions for each item.
    """

    def __init__(self, size_bits: int = 8192, hash_count: int = 7) -> None:
        self.size_bits = size_bits
        self.hash_count = hash_count
        self.bit_array = bytearray(size_bits // 8)
        self.item_count = 0

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def _hashes(self, item: str) -> List[int]:
        """Return ``hash_count`` bit positions for *item*."""
        positions: List[int] = []
        for i in range(self.hash_count):
            h = hashlib.sha256(f"{i}:{item}".encode()).digest()
            pos = struct.unpack("I", h[:4])[0] % self.size_bits
            positions.append(pos)
        return positions

    def add(self, item: str) -> None:
        """Insert *item* into the filter."""
        for pos in self._hashes(item):
            byte_idx = pos // 8
            bit_idx = pos % 8
            self.bit_array[byte_idx] |= 1 << bit_idx
        self.item_count += 1

    def check(self, item: str) -> bool:
        """Return ``True`` if *item* is probably in the filter."""
        for pos in self._hashes(item):
            byte_idx = pos // 8
            bit_idx = pos % 8
            if not (self.bit_array[byte_idx] & (1 << bit_idx)):
                return False
        return True

    # ------------------------------------------------------------------
    # Diagnostics & serialisation
    # ------------------------------------------------------------------

    @property
    def fill_ratio(self) -> float:
        """Fraction of bits that are set."""
        set_bits = sum(bin(b).count("1") for b in self.bit_array)
        return set_bits / self.size_bits if self.size_bits > 0 else 0.0

    def export_base64(self) -> str:
        """Serialise the bit-array to a base-64 string."""
        return base64.b64encode(bytes(self.bit_array)).decode()

    @classmethod
    def from_base64(
        cls, data: str, size_bits: int, hash_count: int
    ) -> BloomFilter:
        """Deserialise a filter from a base-64 encoded bit-array."""
        bf = cls(size_bits=size_bits, hash_count=hash_count)
        bf.bit_array = bytearray(base64.b64decode(data))
        return bf

    def merge(self, other: BloomFilter) -> None:
        """OR-merge *other* into this filter (union)."""
        if self.size_bits != other.size_bits:
            raise ValueError("Cannot merge filters of different sizes")
        for i in range(len(self.bit_array)):
            self.bit_array[i] |= other.bit_array[i]


# ------------------------------------------------------------------
# Module-level state
# ------------------------------------------------------------------
_local_filter: Optional[BloomFilter] = None
_peer_filters: Dict[str, BloomFilter] = {}
_merged_filter: Optional[BloomFilter] = None


def hash_signal(raw_value: str) -> str:
    """HMAC-SHA256 hash a raw signal value using the consortium secret."""
    secret = settings.CONSORTIUM_SECRET or "default-dev-secret"
    return hmac.new(
        secret.encode(), raw_value.encode(), hashlib.sha256
    ).hexdigest()


def get_local_filter() -> BloomFilter:
    """Return (lazily-created) local Bloom filter."""
    global _local_filter
    if _local_filter is None:
        _local_filter = BloomFilter()
    return _local_filter


def add_bad_signal(raw_value: str) -> None:
    """Hash and insert a fraud signal into the local filter."""
    bf = get_local_filter()
    hashed = hash_signal(raw_value)
    bf.add(hashed)


def build_filter_from_db(db) -> BloomFilter:
    """Rebuild the local filter from flagged/blocked transactions in the DB."""
    global _local_filter
    from app.models.transaction import Transaction

    _local_filter = BloomFilter()
    bad_txns = (
        db.query(Transaction)
        .filter(Transaction.status.in_(["FLAGGED", "BLOCKED"]))
        .all()
    )
    for txn in bad_txns:
        if txn.idempotency_key:
            _local_filter.add(hash_signal(txn.idempotency_key))
    logger.info(
        "Built local bloom filter with %d items", _local_filter.item_count
    )
    return _local_filter


def import_peer_filter(
    peer_id: str, data: str, size_bits: int, hash_count: int
) -> None:
    """Import a base-64 encoded Bloom filter from a consortium peer."""
    global _merged_filter
    peer_bf = BloomFilter.from_base64(data, size_bits, hash_count)
    _peer_filters[peer_id] = peer_bf
    _rebuild_merged()
    logger.info("Imported bloom filter from peer %s", peer_id)


def _rebuild_merged() -> None:
    """Reconstruct the merged filter from local + all peer filters."""
    global _merged_filter
    local = get_local_filter()
    _merged_filter = BloomFilter(
        size_bits=local.size_bits, hash_count=local.hash_count
    )
    _merged_filter.bit_array = bytearray(local.bit_array)
    _merged_filter.item_count = local.item_count
    for peer_bf in _peer_filters.values():
        _merged_filter.merge(peer_bf)


def check_signal(raw_value: str) -> bool:
    """Check whether a raw signal has been seen in local + peer filters."""
    hashed = hash_signal(raw_value)
    if _merged_filter:
        return _merged_filter.check(hashed)
    return get_local_filter().check(hashed)


def get_status() -> dict:
    """Return consortium health / status information."""
    local = get_local_filter()
    return {
        "enabled": getattr(settings, "CONSORTIUM_ENABLED", False),
        "local_filter_size": local.size_bits,
        "local_item_count": local.item_count,
        "local_fill_ratio": round(local.fill_ratio, 4),
        "peer_count": len(_peer_filters),
        "peers": list(_peer_filters.keys()),
    }
