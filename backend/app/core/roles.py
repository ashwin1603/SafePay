"""Central definition of roles and their privilege ordering."""

USER = "user"
OPERATOR = "operator"   # can view ops dashboards, retrain model
ADMIN = "admin"         # full administrative control

ALL_ROLES = {USER, OPERATOR, ADMIN}

# Higher number = more privilege. Used for "at least this role" checks.
_RANK = {USER: 1, OPERATOR: 2, ADMIN: 3}


def at_least(role: str, minimum: str) -> bool:
    return _RANK.get(role, 0) >= _RANK.get(minimum, 99)
