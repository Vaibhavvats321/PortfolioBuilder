"""baseline

Revision ID: bde0410d8ab0
Revises:
Create Date: 2026-10-17 07:44:11.185777
"""

# revision identifiers, used by Alembic.
revision: str = "bde0410d8ab0"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Establish the migration baseline. No schema changes yet."""


def downgrade() -> None:
    """Revert the baseline. No schema changes yet."""
