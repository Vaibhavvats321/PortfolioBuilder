"""add theme configs and section style overrides

Revision ID: b3f1a2c9d4e5
Revises: 8ce37cca0938
Create Date: 2026-10-17 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3f1a2c9d4e5"
down_revision: str | None = "8ce37cca0938"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create theme_configs and add per-section style overrides."""
    op.create_table(
        "theme_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column(
            "config_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("schema_version", sa.Integer(), server_default=sa.text("1"), nullable=False),
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
        sa.CheckConstraint("schema_version >= 1", name="ck_theme_configs_schema_version"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_theme_configs_portfolio_id"), "theme_configs", ["portfolio_id"], unique=True
    )

    op.add_column(
        "page_sections",
        sa.Column(
            "style_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop per-section style overrides and the theme_configs table."""
    op.drop_column("page_sections", "style_json")
    op.drop_index(op.f("ix_theme_configs_portfolio_id"), table_name="theme_configs")
    op.drop_table("theme_configs")
