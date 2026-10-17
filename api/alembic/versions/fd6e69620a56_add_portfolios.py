"""add portfolios

Revision ID: fd6e69620a56
Revises: 8c93ddb92f85
Create Date: 2026-10-17 09:02:16.634550

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fd6e69620a56"
down_revision: str | None = "8c93ddb92f85"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the portfolios table."""
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column(
            "settings_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_portfolios_status"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolios_owner_id"), "portfolios", ["owner_id"], unique=False)
    op.create_index(op.f("ix_portfolios_slug"), "portfolios", ["slug"], unique=True)


def downgrade() -> None:
    """Drop the portfolios table."""
    op.drop_index(op.f("ix_portfolios_slug"), table_name="portfolios")
    op.drop_index(op.f("ix_portfolios_owner_id"), table_name="portfolios")
    op.drop_table("portfolios")
