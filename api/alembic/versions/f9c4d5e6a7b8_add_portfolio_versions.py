"""add portfolio versions and publication pointers

Revision ID: f9c4d5e6a7b8
Revises: e1f8a7b3c9d0
Create Date: 2026-10-18 10:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f9c4d5e6a7b8"
down_revision: str | None = "e1f8a7b3c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create portfolio_versions and add publication columns to portfolios."""
    op.create_table(
        "portfolio_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("published_by", sa.Uuid(), nullable=False),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("version_number >= 1", name="ck_portfolio_versions_number_positive"),
        sa.ForeignKeyConstraint(
            ["portfolio_id"],
            ["portfolios.id"],
            ondelete="CASCADE",
            name="fk_portfolio_versions_portfolio_id",
        ),
        sa.ForeignKeyConstraint(["published_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "portfolio_id", "version_number", name="uq_portfolio_versions_portfolio_version"
        ),
    )
    op.create_index(
        op.f("ix_portfolio_versions_portfolio_id"),
        "portfolio_versions",
        ["portfolio_id"],
        unique=False,
    )
    op.add_column(
        "portfolios",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "portfolios",
        sa.Column("current_published_version_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_portfolios_current_published_version",
        "portfolios",
        "portfolio_versions",
        ["current_published_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Drop publication columns and portfolio_versions."""
    op.drop_constraint(
        "fk_portfolios_current_published_version",
        "portfolios",
        type_="foreignkey",
    )
    op.drop_column("portfolios", "current_published_version_id")
    op.drop_column("portfolios", "published_at")
    op.drop_index(op.f("ix_portfolio_versions_portfolio_id"), table_name="portfolio_versions")
    op.drop_table("portfolio_versions")
