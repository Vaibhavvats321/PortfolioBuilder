"""add media assets

Revision ID: e1f8a7b3c9d0
Revises: b3f1a2c9d4e5
Create Date: 2026-10-17 14:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e1f8a7b3c9d0"
down_revision: str | None = "b3f1a2c9d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create media_assets table."""
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=127), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("alt_text", sa.String(length=255), nullable=True),
        sa.Column("caption", sa.String(length=500), nullable=True),
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
        sa.CheckConstraint("size_bytes > 0", name="ck_media_assets_size_positive"),
        sa.CheckConstraint("width IS NULL OR width > 0", name="ck_media_assets_width_positive"),
        sa.CheckConstraint("height IS NULL OR height > 0", name="ck_media_assets_height_positive"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("portfolio_id", "storage_key", name="uq_media_assets_portfolio_key"),
    )
    op.create_index(
        op.f("ix_media_assets_portfolio_id"), "media_assets", ["portfolio_id"], unique=False
    )
    op.create_index(
        op.f("ix_media_assets_storage_key"), "media_assets", ["storage_key"], unique=False
    )


def downgrade() -> None:
    """Drop media_assets table."""
    op.drop_index(op.f("ix_media_assets_storage_key"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_portfolio_id"), table_name="media_assets")
    op.drop_table("media_assets")
