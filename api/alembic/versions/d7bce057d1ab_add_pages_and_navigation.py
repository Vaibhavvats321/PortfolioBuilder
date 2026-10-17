"""add pages and navigation

Revision ID: d7bce057d1ab
Revises: fd6e69620a56
Create Date: 2026-10-17 09:56:21.343303

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7bce057d1ab"
down_revision: str | None = "fd6e69620a56"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the pages and navigation_items tables."""
    op.create_table(
        "pages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("is_homepage", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_visible", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("seo_title", sa.String(length=200), nullable=True),
        sa.Column("seo_description", sa.String(length=500), nullable=True),
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
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_pages_status"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("portfolio_id", "slug", name="uq_pages_portfolio_slug"),
    )
    op.create_index(op.f("ix_pages_portfolio_id"), "pages", ["portfolio_id"], unique=False)
    op.create_index(
        "uq_pages_portfolio_homepage",
        "pages",
        ["portfolio_id"],
        unique=True,
        postgresql_where=sa.text("is_homepage"),
    )

    op.create_table(
        "navigation_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("location", sa.String(length=20), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("destination_type", sa.String(length=20), nullable=False),
        sa.Column("page_id", sa.Uuid(), nullable=True),
        sa.Column("external_url", sa.String(length=2048), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_visible", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint(
            "(destination_type = 'page' AND page_id IS NOT NULL AND external_url IS NULL) OR "
            "(destination_type = 'external_url' AND external_url IS NOT NULL AND page_id IS NULL)",
            name="ck_navigation_items_destination_consistency",
        ),
        sa.CheckConstraint(
            "destination_type IN ('page', 'external_url')",
            name="ck_navigation_items_destination_type",
        ),
        sa.CheckConstraint(
            "location IN ('header', 'footer', 'sidebar')",
            name="ck_navigation_items_location",
        ),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_navigation_items_page_id"), "navigation_items", ["page_id"], unique=False
    )
    op.create_index(
        op.f("ix_navigation_items_portfolio_id"),
        "navigation_items",
        ["portfolio_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the navigation_items and pages tables."""
    op.drop_index(op.f("ix_navigation_items_portfolio_id"), table_name="navigation_items")
    op.drop_index(op.f("ix_navigation_items_page_id"), table_name="navigation_items")
    op.drop_table("navigation_items")
    op.drop_index(
        "uq_pages_portfolio_homepage",
        table_name="pages",
        postgresql_where=sa.text("is_homepage"),
    )
    op.drop_index(op.f("ix_pages_portfolio_id"), table_name="pages")
    op.drop_table("pages")
