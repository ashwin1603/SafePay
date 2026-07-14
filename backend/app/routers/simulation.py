"""Attack-Mode Simulation Sandbox endpoints."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import client_ip, get_db, require_permission
from app.core.permissions import SIMULATION_RUN
from app.schemas.simulation import ScenarioInfo, SimulationRequest, SimulationResult
from app.services.audit_service import record
from app.services.simulation_service import SCENARIOS, run_simulation

router = APIRouter(prefix="/simulation", tags=["Simulation"])


@router.get("/scenarios", response_model=List[ScenarioInfo])
def list_scenarios(
    principal=Depends(require_permission(SIMULATION_RUN)),
):
    """Return all available attack-simulation scenarios."""
    return [
        ScenarioInfo(
            id=k,
            name=v["name"],
            description=v["description"],
            default_count=v["default_count"],
        )
        for k, v in SCENARIOS.items()
    ]


@router.post("/run", response_model=SimulationResult)
def run_sim(
    payload: SimulationRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(SIMULATION_RUN)),
):
    """Execute a simulation scenario and return detection results."""
    result = run_simulation(payload.scenario, payload.count)
    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="simulation_run",
        ip=client_ip(request),
        target=payload.scenario,
        detail=f"count={payload.count} caught={result['caught']}/{result['total']}",
    )
    return result
