"""Theme and design system registry.

This package is the single source of truth for the portfolio design system. It
declares the editable theme *tokens* (colors, typography, spacing, borders,
buttons, cards, links, background) and *components* (header, footer, sidebar,
branding, social) as ordered groups of validated fields, mirroring the section
registry.

The registry is code (part of the engine); the *values* a user chooses are
stored as validated JSON on ``theme_configs``. Defaults, backend validation, and
the visual editor controls are all derived from the same descriptors, so a
design option cannot drift between the schema, its defaults, and the UI.
"""
