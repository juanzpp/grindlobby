"""Bootstrap a minimum storefront catalog before app.main initializes the rest of the CRM DB.

This runs when Python imports the ``app`` package. It is intentionally idempotent so existing
preview databases only receive missing SKUs while clean deployments start with the same catalog.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent / "adega.db"

_PRODUCTS = [
    ("Heineken Long Neck 330ml", "Cervejas", "HEI330", 4.30, 7.90, 32, 12, 330),
    ("Budweiser Long Neck 330ml", "Cervejas", "BUD330", 3.80, 6.90, 27, 12, 330),
    ("Red Bull 250ml", "Energéticos", "RB250", 6.20, 10.90, 18, 8, 250),
    ("Skol Pilsen 350ml", "Cervejas", "SK350", 2.70, 4.50, 15, 10, 350),
    ("Jack Daniel's 1L", "Whisky", "JD1L", 112.00, 179.90, 11, 5, 1000),
    ("Vodka Absolut 750ml", "Vodka", "ABS750", 44.00, 69.90, 9, 5, 750),
    ("Eternity Dry Gin Coco & Açaí 900ml", "Gin", "ETCOCO900", 18.50, 29.90, 18, 6, 900),
    ("Eternity Dry Gin Royale Dark Berry 900ml", "Gin", "ETROY900", 18.50, 29.90, 18, 6, 900),
    ("Pitú Aguardente 965ml", "Cachaças", "PITU965", 12.00, 19.90, 20, 8, 965),
    ("Original Pilsen 600ml", "Cervejas", "ORIG600", 7.50, 12.90, 24, 10, 600),
    ("Guaraná Antarctica 350ml", "Refrigerantes", "GUA350", 2.80, 5.50, 30, 10, 350),
    ("Budweiser 473ml", "Cervejas", "BUD473", 4.60, 7.90, 24, 10, 473),
    ("Brahma Duplo Malte 473ml", "Cervejas", "BRAH473", 3.90, 6.90, 28, 10, 473),
]


def _bootstrap_storefront_catalog() -> None:
    conn = sqlite3.connect(_DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              category TEXT NOT NULL,
              sku TEXT UNIQUE,
              barcode TEXT,
              cost REAL NOT NULL DEFAULT 0,
              price REAL NOT NULL CHECK(price >= 0),
              stock INTEGER NOT NULL DEFAULT 0,
              min_stock INTEGER NOT NULL DEFAULT 5,
              active INTEGER NOT NULL DEFAULT 1,
              storefront INTEGER NOT NULL DEFAULT 1,
              volume_ml INTEGER,
              image_url TEXT,
              created_at TEXT NOT NULL
            )
            """
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
        if "storefront" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN storefront INTEGER NOT NULL DEFAULT 1")
        if "volume_ml" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN volume_ml INTEGER")
        if "image_url" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
        created_at = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            """
            INSERT OR IGNORE INTO products(
              name,category,sku,cost,price,stock,min_stock,storefront,volume_ml,created_at
            ) VALUES(?,?,?,?,?,?,?,1,?,?)
            """,
            [(*product, created_at) for product in _PRODUCTS],
        )
        conn.commit()
    finally:
        conn.close()


_bootstrap_storefront_catalog()
