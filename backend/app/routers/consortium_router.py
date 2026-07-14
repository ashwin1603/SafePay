"""Consortium endpoints — privacy-preserving shared fraud signals."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import client_ip, get_db, require_permission
from app.core.permissions import CONSORTIUM_MANAGE
from app.schemas.consortium import (
    BloomFilterExport,
    BloomFilterImport,
    ConsortiumStatus,
    SignalCheckRequest,
    SignalCheckResponse,
)
from app.services.audit_service import record
from app.services import consortium as consortium_svc

router = APIRouter(prefix="/consortium", tags=["Consortium"])


@router.get("/status", response_model=ConsortiumStatus)
def consortium_status(
    principal=Depends(require_permission(CONSORTIUM_MANAGE)),
):
    """Return the current consortium membership and sync status."""
    return consortium_svc.get_status()


@router.get("/bloom", response_model=BloomFilterExport)
def export_bloom(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(CONSORTIUM_MANAGE)),
):
    """Export our local Bloom filter for peer synchronisation."""
    bf = consortium_svc.build_filter_from_db(db)
    return BloomFilterExport(
        filter_base64=bf.export_base64(),
        size_bits=bf.size_bits,
        hash_count=bf.hash_count,
        item_count=bf.item_count,
        fill_ratio=round(bf.fill_ratio, 4),
    )


@router.post("/sync")
def sync_peer(
    payload: BloomFilterImport,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(CONSORTIUM_MANAGE)),
):
    """Import a peer institution's Bloom filter for cross-checking."""
    consortium_svc.import_peer_filter(
        payload.peer_id,
        payload.filter_base64,
        payload.size_bits,
        payload.hash_count,
    )
    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="consortium_sync",
        ip=client_ip(request),
        target=payload.peer_id,
        detail=f"imported bloom filter from {payload.peer_id}",
    )
    return {"detail": f"Synced with peer {payload.peer_id}"}


@router.post("/check", response_model=SignalCheckResponse)
def check_signals(
    payload: SignalCheckRequest,
    principal=Depends(require_permission(CONSORTIUM_MANAGE)),
):
    """Check a batch of hashed signals against all known Bloom filters."""
    matches = []
    for sig in payload.hashed_signals:
        is_match = consortium_svc.check_signal(sig)
        matches.append({"signal": sig[:16] + "...", "match": is_match})
    total_matches = sum(1 for m in matches if m["match"])
    return SignalCheckResponse(
        matches=matches,
        total_checked=len(matches),
        total_matches=total_matches,
    )
