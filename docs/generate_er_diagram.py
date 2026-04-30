"""
Generates docs/er_diagram.png — an ER diagram of the plzbuy.me MySQL schema.

Run from repo root (or anywhere):
    python3 docs/generate_er_diagram.py

Re-run whenever §4.2 of docs/TECH_DOC.md changes. The diagram mirrors the EF
Core models in plzbuyme-backend/PlzBuyMe.Api/Models/.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib.lines import Line2D


# ---------- Schema definition --------------------------------------------------

@dataclass
class Field:
    name: str
    type: str
    pk: bool = False
    fk: str | None = None  # "table.column"
    nullable: bool = False
    unique: bool = False


@dataclass
class Entity:
    name: str
    fields: list[Field]
    note: str | None = None
    cx: float = 0.0  # center x (axis units)
    cy: float = 0.0  # center y (axis units)
    width: float = 5.0
    color: str = "#E8F1FB"
    header: str = "#1F4E79"


ENTITIES: list[Entity] = [
    Entity(
        name="users",
        color="#FFF3E0", header="#B26A00",
        fields=[
            Field("id", "INT", pk=True),
            Field("username", "VARCHAR(64)", unique=True),
            Field("email", "VARCHAR(128)", unique=True),
            Field("password_hash", "VARCHAR(256)"),
            Field("role", "ENUM(end_user,vip,customer_rep,admin)"),
            Field("avatar_url", "VARCHAR(2048)", nullable=True),
            Field("display_name_color", "VARCHAR(32)", nullable=True),
            Field("is_active", "BOOLEAN"),
            Field("wallet_balance", "DECIMAL(12,2)"),
            Field("created_at", "DATETIME"),
        ],
    ),
    Entity(
        name="items",
        color="#E8F5E9", header="#2E7D32",
        fields=[
            Field("id", "INT", pk=True),
            Field("seller_id", "INT", fk="users.id"),
            Field("category_ids", "JSON  (array)"),
            Field("title", "VARCHAR(256)"),
            Field("description", "TEXT", nullable=True),
            Field("image_url", "VARCHAR(2048)", nullable=True),
            Field("initial_price", "DECIMAL(12,2)"),
            Field("bid_increment", "DECIMAL(12,2)"),
            Field("reserve_price", "DECIMAL(12,2)"),
            Field("current_price", "DECIMAL(12,2)"),
            Field("close_datetime", "DATETIME"),
            Field("status", "ENUM(active,closed,sold,removed)"),
            Field("winner_id", "INT", fk="users.id", nullable=True),
            Field("created_at", "DATETIME"),
        ],
        note="category_ids[0] = primary category;\nadditional entries are subcategory tags.",
    ),
    Entity(
        name="categories",
        color="#F3E5F5", header="#6A1B9A",
        fields=[
            Field("id", "INT", pk=True),
            Field("name", "VARCHAR(64)"),
            Field("parent_id", "INT", fk="categories.id", nullable=True),
            Field("string_key", "VARCHAR(64)", unique=True, nullable=True),
            Field("lucide_icon_key", "VARCHAR(64)", nullable=True),
        ],
        note="Self-referencing tree\n(parent_id → categories.id).",
    ),
    Entity(
        name="category_fields",
        color="#F3E5F5", header="#6A1B9A",
        fields=[
            Field("id", "INT", pk=True),
            Field("category_id", "INT", fk="categories.id"),
            Field("field_name", "VARCHAR(64)"),
            Field("field_type", "ENUM(text,number,select)"),
            Field("is_required", "BOOLEAN"),
            Field("options", "JSON", nullable=True),
        ],
    ),
    Entity(
        name="item_field_values",
        color="#E8F5E9", header="#2E7D32",
        fields=[
            Field("id", "INT", pk=True),
            Field("item_id", "INT", fk="items.id"),
            Field("field_id", "INT", fk="category_fields.id"),
            Field("value", "VARCHAR(256)"),
        ],
        note="UNIQUE (item_id, field_id)",
    ),
    Entity(
        name="bids",
        color="#FFFDE7", header="#9E7B00",
        fields=[
            Field("id", "INT", pk=True),
            Field("item_id", "INT", fk="items.id"),
            Field("bidder_id", "INT", fk="users.id"),
            Field("amount", "DECIMAL(12,2)"),
            Field("is_auto", "BOOLEAN"),
            Field("created_at", "DATETIME"),
        ],
    ),
    Entity(
        name="bid_holds",
        color="#FFFDE7", header="#9E7B00",
        fields=[
            Field("id", "INT", pk=True),
            Field("item_id", "INT", fk="items.id", unique=True),
            Field("user_id", "INT", fk="users.id"),
            Field("amount", "DECIMAL(12,2)"),
        ],
        note="At most ONE row per item\n(current high bidder's hold).",
    ),
    Entity(
        name="auto_bids",
        color="#FFFDE7", header="#9E7B00",
        fields=[
            Field("id", "INT", pk=True),
            Field("item_id", "INT", fk="items.id"),
            Field("bidder_id", "INT", fk="users.id"),
            Field("upper_limit", "DECIMAL(12,2)"),
            Field("is_active", "BOOLEAN"),
            Field("created_at", "DATETIME"),
        ],
        note="UNIQUE (item_id, bidder_id)",
    ),
    Entity(
        name="alerts",
        color="#E1F5FE", header="#01579B",
        fields=[
            Field("id", "INT", pk=True),
            Field("user_id", "INT", fk="users.id"),
            Field("category_id", "INT", fk="categories.id", nullable=True),
            Field("keyword", "VARCHAR(128)", nullable=True),
            Field("criteria", "JSON", nullable=True),
            Field("is_active", "BOOLEAN"),
            Field("created_at", "DATETIME"),
        ],
    ),
    Entity(
        name="notifications",
        color="#E1F5FE", header="#01579B",
        fields=[
            Field("id", "INT", pk=True),
            Field("user_id", "INT", fk="users.id"),
            Field("item_id", "INT", fk="items.id", nullable=True),
            Field("message", "TEXT"),
            Field("type", "VARCHAR(32)"),
            Field("is_read", "BOOLEAN"),
            Field("created_at", "DATETIME"),
        ],
    ),
    Entity(
        name="questions",
        color="#FCE4EC", header="#AD1457",
        fields=[
            Field("id", "INT", pk=True),
            Field("user_id", "INT", fk="users.id"),
            Field("subject", "VARCHAR(256)"),
            Field("body", "TEXT"),
            Field("created_at", "DATETIME"),
        ],
    ),
    Entity(
        name="question_replies",
        color="#FCE4EC", header="#AD1457",
        fields=[
            Field("id", "INT", pk=True),
            Field("question_id", "INT", fk="questions.id"),
            Field("parent_reply_id", "INT", fk="question_replies.id", nullable=True),
            Field("replied_by_user_id", "INT", fk="users.id", nullable=True),
            Field("body", "TEXT"),
            Field("replier_display_name", "VARCHAR(128)"),
            Field("replier_role", "VARCHAR(32)", nullable=True),
            Field("created_at", "DATETIME"),
        ],
        note="Self-referencing tree for\nthreaded replies.",
    ),
    Entity(
        name="question_votes",
        color="#FCE4EC", header="#AD1457",
        fields=[
            Field("id", "INT", pk=True),
            Field("user_id", "INT", fk="users.id"),
            Field("question_id", "INT", fk="questions.id", nullable=True),
            Field("question_reply_id", "INT", fk="question_replies.id", nullable=True),
            Field("value", "INT"),
            Field("created_at", "DATETIME"),
        ],
        note="Vote targets EITHER\nquestion_id OR question_reply_id.",
    ),
]


# ---------- Layout (axis units, canvas: 0..120 wide, 0..80 tall) ---------------

LAYOUT: dict[str, tuple[float, float, float]] = {
    # name: (cx, cy, width)
    # --- Top row (y ~ 70): user-facing notifications & auto-bidding -----------
    "auto_bids":          (16,  70, 20),
    "alerts":              (54, 70, 22),
    "notifications":      (96,  70, 22),

    # --- Middle row (y ~ 44): the core ---------------------------------------
    "users":              (16,  44, 22),
    "items":              (54,  44, 26),
    "categories":         (96,  52, 22),

    # --- Lower-middle row (y ~ 22): join tables ------------------------------
    "bids":               (16,  20, 19),
    "item_field_values":  (54,  20, 21),
    "category_fields":    (96,  22, 22),

    # --- Bottom row (y ~ 4): Q&A + holds -------------------------------------
    "bid_holds":          (16,   4, 19),
    "questions":          (40,   4, 19),
    "question_replies":   (70,   4, 23),
    "question_votes":     (101,  4, 23),
}


# ---------- Drawing ------------------------------------------------------------

ROW_H = 1.3          # axis units per row inside an entity
HEADER_H = 2.4       # header row height
FOOTER_H = 1.2       # padding below last row
NOTE_H = 1.6


def entity_dimensions(e: Entity) -> tuple[float, float]:
    """Return (width, height) of the box in axis units."""
    n_rows = len(e.fields)
    note_lines = (e.note.count("\n") + 1) if e.note else 0
    height = HEADER_H + n_rows * ROW_H + FOOTER_H + note_lines * NOTE_H
    return e.width, height


def draw_entity(ax, e: Entity) -> dict[str, tuple[float, float]]:
    """Draw an entity box; return per-field anchor points {field_name: (x, y)}."""
    w, h = entity_dimensions(e)
    left = e.cx - w / 2
    bottom = e.cy - h / 2

    # Outer box (white background with subtle border)
    box = FancyBboxPatch(
        (left, bottom), w, h,
        boxstyle="round,pad=0.05,rounding_size=0.6",
        linewidth=1.0,
        edgecolor="#333",
        facecolor="white",
        zorder=2,
    )
    ax.add_patch(box)

    # Header band
    header_rect = Rectangle(
        (left, bottom + h - HEADER_H), w, HEADER_H,
        linewidth=0,
        facecolor=e.header,
        zorder=3,
    )
    ax.add_patch(header_rect)
    ax.text(
        e.cx, bottom + h - HEADER_H / 2,
        e.name,
        ha="center", va="center",
        color="white", fontsize=11, fontweight="bold",
        family="DejaVu Sans Mono",
        zorder=4,
    )

    anchors: dict[str, tuple[float, float]] = {}
    field_top = bottom + h - HEADER_H
    for i, f in enumerate(e.fields):
        row_y = field_top - (i + 0.5) * ROW_H
        # Zebra stripe
        if i % 2 == 1:
            ax.add_patch(Rectangle(
                (left, row_y - ROW_H / 2), w, ROW_H,
                linewidth=0, facecolor=e.color, zorder=2.5,
            ))

        # Markers (PK / FK)
        marker = ""
        marker_color = "#666"
        if f.pk:
            marker = "PK"
            marker_color = "#B22222"
        elif f.fk:
            marker = "FK"
            marker_color = "#1F4E79"
        if marker:
            ax.text(
                left + 0.5, row_y, marker,
                ha="left", va="center",
                color=marker_color, fontsize=7.5, fontweight="bold",
                family="DejaVu Sans Mono", zorder=5,
            )

        # Field name
        name_label = f.name
        if f.unique and not f.pk:
            name_label += " *"
        if f.nullable:
            name_label += " ?"
        ax.text(
            left + 2.2, row_y, name_label,
            ha="left", va="center",
            color="#111", fontsize=8.5,
            family="DejaVu Sans Mono", zorder=5,
        )

        # Type (right-aligned)
        ax.text(
            left + w - 0.4, row_y, f.type,
            ha="right", va="center",
            color="#555", fontsize=7.5,
            family="DejaVu Sans Mono", zorder=5,
        )

        anchors[f.name] = (e.cx, row_y)
        anchors[f"{f.name}@left"] = (left, row_y)
        anchors[f"{f.name}@right"] = (left + w, row_y)

    # Optional note under fields
    if e.note:
        note_y = bottom + 0.4
        for j, line in enumerate(reversed(e.note.split("\n"))):
            ax.text(
                e.cx, note_y + j * NOTE_H * 0.55, line,
                ha="center", va="bottom",
                color="#444", fontsize=7.5, fontstyle="italic",
                zorder=5,
            )

    # Store box bounds for connection routing
    e._bounds = (left, bottom, left + w, bottom + h)  # type: ignore[attr-defined]
    return anchors


def best_side_anchor(
    src_e: Entity, dst_e: Entity,
    src_anchors: dict[str, tuple[float, float]],
    dst_anchors: dict[str, tuple[float, float]],
    src_field: str, dst_field: str,
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Pick the best left/right anchors so the connector exits the correct side."""
    src_left, _, src_right, _ = src_e._bounds  # type: ignore[attr-defined]
    dst_left, _, dst_right, _ = dst_e._bounds  # type: ignore[attr-defined]
    if dst_e.cx >= src_e.cx:
        sp = src_anchors[f"{src_field}@right"]
        dp = dst_anchors[f"{dst_field}@left"]
    else:
        sp = src_anchors[f"{src_field}@left"]
        dp = dst_anchors[f"{dst_field}@right"]
    return sp, dp


def draw_relationship(
    ax,
    src_anchor: tuple[float, float],
    dst_anchor: tuple[float, float],
    src_card: str = "N",
    dst_card: str = "1",
    color: str = "#1F4E79",
    style: str = "-",
    rad: float = 0.15,
):
    """Draw a curved line from src to dst with cardinality labels at each end."""
    arrow = FancyArrowPatch(
        src_anchor, dst_anchor,
        connectionstyle=f"arc3,rad={rad}",
        arrowstyle="-",
        color=color,
        linewidth=1.1,
        linestyle=style,
        zorder=1.5,
    )
    ax.add_patch(arrow)

    def _bubble(x, y, text):
        ax.scatter(
            [x], [y], s=110,
            facecolor="white", edgecolor=color, linewidth=0.9, zorder=6,
        )
        ax.text(
            x, y, text,
            ha="center", va="center",
            fontsize=6.5, color=color, fontweight="bold", zorder=7,
        )

    sx, sy = src_anchor
    dx, dy = dst_anchor

    def _offset(p1, p2, dist=1.7):
        x1, y1 = p1
        x2, y2 = p2
        dx_, dy_ = x2 - x1, y2 - y1
        d = (dx_ ** 2 + dy_ ** 2) ** 0.5 or 1.0
        return x1 + dx_ / d * dist, y1 + dy_ / d * dist

    sb = _offset((sx, sy), (dx, dy))
    db = _offset((dx, dy), (sx, sy))
    _bubble(*sb, src_card)
    _bubble(*db, dst_card)


# ---------- Relationships ------------------------------------------------------

# (child_table, child_fk_field, parent_table, parent_field, child_card, parent_card, rad)
# Cardinality is read at the bubble nearest that table.
# For FK: child = "many" side ("N"), parent = "one" side ("1").
RELATIONSHIPS: list[tuple[str, str, str, str, str, str, float]] = [
    # Core: users <-> items
    ("items",             "seller_id",          "users",      "id", "N", "1",   0.10),
    ("items",             "winner_id",          "users",      "id", "N", "0..1", -0.25),

    # Bidding column (left)
    ("bids",              "item_id",            "items",      "id", "N", "1",   0.10),
    ("bids",              "bidder_id",          "users",      "id", "N", "1",   0.00),
    ("bid_holds",         "item_id",            "items",      "id", "1", "1",   0.15),
    ("bid_holds",         "user_id",            "users",      "id", "N", "1",  -0.10),
    ("auto_bids",         "item_id",            "items",      "id", "N", "1",  -0.10),
    ("auto_bids",         "bidder_id",          "users",      "id", "N", "1",   0.00),

    # Categorization (right)
    ("category_fields",   "category_id",        "categories", "id", "N", "1",  -0.15),
    ("item_field_values", "item_id",            "items",      "id", "N", "1",   0.05),
    ("item_field_values", "field_id",           "category_fields", "id", "N", "1",   0.10),

    # User-facing notifications (top)
    ("alerts",            "user_id",            "users",      "id", "N", "1",  -0.15),
    ("alerts",            "category_id",        "categories", "id", "N", "0..1", 0.10),
    ("notifications",     "user_id",            "users",      "id", "N", "1",  -0.30),
    ("notifications",     "item_id",            "items",      "id", "N", "0..1", -0.20),

    # Q&A (bottom)
    ("questions",         "user_id",            "users",      "id", "N", "1",  -0.10),
    ("question_replies",  "question_id",        "questions",  "id", "N", "1",   0.10),
    ("question_replies",  "replied_by_user_id", "users",      "id", "N", "0..1", -0.40),
    ("question_votes",    "user_id",            "users",      "id", "N", "1",   0.45),
    ("question_votes",    "question_id",        "questions",  "id", "N", "0..1", -0.15),
    ("question_votes",    "question_reply_id",  "question_replies", "id", "N", "0..1", 0.10),

    # Self-references (small loop on the right side of the entity)
    ("categories",        "parent_id",          "categories", "id", "N", "0..1", 0.0),
    ("question_replies",  "parent_reply_id",    "question_replies", "id", "N", "0..1", 0.0),
]


def draw_self_loop(ax, e: Entity, fk_field: str, anchors: dict[str, tuple[float, float]]):
    """Draw a small loop on the right side of an entity for a self-referencing FK."""
    left, bottom, right, top = e._bounds  # type: ignore[attr-defined]
    fx, fy = anchors[f"{fk_field}@right"]
    pkx, pky = anchors["id@right"]
    color = "#1F4E79"
    arrow = FancyArrowPatch(
        (fx, fy), (pkx, pky),
        connectionstyle="arc3,rad=-1.4",
        arrowstyle="-|>",
        mutation_scale=10,
        color=color,
        linewidth=1.2,
        zorder=1.5,
    )
    ax.add_patch(arrow)

    loop_apex_x = right + 3.5
    loop_apex_y = (fy + pky) / 2
    ax.text(
        loop_apex_x, loop_apex_y, "self",
        ha="left", va="center",
        fontsize=7.5, color=color, fontstyle="italic", fontweight="bold",
        zorder=6,
    )


# ---------- Main ---------------------------------------------------------------

def main() -> None:
    out_path = Path(__file__).resolve().parent / "er_diagram.png"

    # Apply layout to entities
    by_name = {e.name: e for e in ENTITIES}
    for name, (cx, cy, w) in LAYOUT.items():
        e = by_name[name]
        e.cx, e.cy, e.width = cx, cy, w

    fig, ax = plt.subplots(figsize=(26, 17), dpi=150)
    ax.set_xlim(-2, 122)
    ax.set_ylim(-7, 84)
    ax.set_aspect("equal")
    ax.axis("off")

    # Title
    ax.text(
        60, 82,
        "plzbuy.me — Entity Relationship Diagram",
        ha="center", va="center",
        fontsize=22, fontweight="bold", color="#1F4E79",
    )
    ax.text(
        60, 79.5,
        "MySQL 8 schema (Entity Framework Core code-first models). "
        "PK = primary key, FK = foreign key, * = unique, ? = nullable.",
        ha="center", va="center",
        fontsize=11, color="#444", fontstyle="italic",
    )

    # Draw all entities, collect anchors
    all_anchors: dict[str, dict[str, tuple[float, float]]] = {}
    for e in ENTITIES:
        all_anchors[e.name] = draw_entity(ax, e)

    # Draw relationships
    for (child, child_fk, parent, parent_field, c_card, p_card, rad) in RELATIONSHIPS:
        ce = by_name[child]
        pe = by_name[parent]
        if child == parent:
            # self loop handled separately
            draw_self_loop(ax, ce, child_fk, all_anchors[child])
            continue
        sp, dp = best_side_anchor(
            ce, pe,
            all_anchors[child], all_anchors[parent],
            child_fk, parent_field,
        )
        draw_relationship(ax, sp, dp, src_card=c_card, dst_card=p_card, rad=rad)

    # Legend
    legend_x = 1.0
    legend_y = -5.0
    legend_items = [
        ("PK", "primary key", "#B22222"),
        ("FK", "foreign key", "#1F4E79"),
        ("*",  "unique",       "#444"),
        ("?",  "nullable",     "#444"),
    ]
    ax.text(
        legend_x, legend_y, "Legend:",
        fontsize=10, fontweight="bold", color="#222",
        ha="left", va="center",
    )
    cursor = legend_x + 8
    for marker, label, col in legend_items:
        ax.text(cursor, legend_y, marker,
                fontsize=10, fontweight="bold", color=col,
                ha="left", va="center", family="DejaVu Sans Mono")
        ax.text(cursor + 2.5, legend_y, label,
                fontsize=10, color="#222", ha="left", va="center")
        cursor += 13

    cursor += 4
    ax.text(cursor, legend_y, "Cardinality:",
            fontsize=10, fontweight="bold", color="#222", ha="left", va="center")
    ax.text(cursor + 9, legend_y,
            "1, N, 0..1 (bubble nearest an entity describes that side of the relation)",
            fontsize=10, color="#222", ha="left", va="center")

    plt.tight_layout()
    fig.savefig(out_path, bbox_inches="tight", facecolor="white", dpi=150)
    plt.close(fig)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
