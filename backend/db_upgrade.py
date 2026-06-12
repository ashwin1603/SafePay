#!/usr/bin/env python3
"""
SafePay database migration helper.

Usage (run from the backend/ directory):
  python db_upgrade.py              # apply all pending migrations (upgrade head)
  python db_upgrade.py downgrade    # roll back one migration
  python db_upgrade.py history      # show migration history
  python db_upgrade.py current      # show current DB revision
  python db_upgrade.py sql          # print SQL that would be applied (dry-run)

You can override the database URL for a one-off run:
  DATABASE_URL=postgresql+psycopg2://... python db_upgrade.py
"""

import subprocess
import sys
import os


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
    sys.exit(result.returncode)


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "upgrade"

    if action == "upgrade":
        print("Applying all pending migrations…")
        run(["alembic", "upgrade", "head"])

    elif action == "downgrade":
        print("Rolling back one migration…")
        run(["alembic", "downgrade", "-1"])

    elif action == "history":
        run(["alembic", "history", "--verbose"])

    elif action == "current":
        run(["alembic", "current"])

    elif action == "sql":
        print("Generating SQL diff (no changes applied)…")
        run(["alembic", "upgrade", "head", "--sql"])

    else:
        print(f"Unknown action: {action}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()