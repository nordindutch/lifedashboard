#!/usr/bin/env python3
"""
Import Open Food Facts Parquet into a local SQLite database for calorie search.

Requirements:
    pip install pandas pyarrow

Usage (run from this directory):
    python import_off.py

Input:  openfoodfacts.parquet  (drop it next to this script)
Output: openfoodfacts.sqlite   (used by the PHP backend automatically)
"""

import os
import sqlite3
import sys
import time

PARQUET = os.path.join(os.path.dirname(__file__), "openfoodfacts.parquet")
SQLITE  = os.path.join(os.path.dirname(__file__), "openfoodfacts.sqlite")

if not os.path.exists(PARQUET):
    print(f"ERROR: {PARQUET} not found. Drop openfoodfacts.parquet next to this script.")
    sys.exit(1)

print(f"Reading {PARQUET} …")
t0 = time.time()

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas pyarrow")
    sys.exit(1)

COLS = ["product_name", "brands", "energy-kcal_100g", "energy_100g", "unique_scans_n"]

df = pd.read_parquet(PARQUET, columns=[c for c in COLS if True], engine="pyarrow")

print(f"Loaded {len(df):,} rows in {time.time() - t0:.1f}s. Filtering …")

df["product_name"] = df["product_name"].fillna("").str.strip()
df = df[df["product_name"] != ""]

# Prefer energy-kcal_100g; fall back to energy_100g (kJ) / 4.184
kcal = df["energy-kcal_100g"].copy()
kj_mask = kcal.isna() | (kcal <= 0)
if "energy_100g" in df.columns:
    kcal[kj_mask] = df.loc[kj_mask, "energy_100g"].fillna(0) / 4.184

df["kcal_per_100g"] = kcal.fillna(0).round().astype(int)
df = df[df["kcal_per_100g"] > 0]

df["brands"] = df["brands"].fillna("").str.strip()

# Sort by scan count so popular products appear first in results
if "unique_scans_n" in df.columns:
    df["unique_scans_n"] = pd.to_numeric(df["unique_scans_n"], errors="coerce").fillna(0)
    df = df.sort_values("unique_scans_n", ascending=False)

print(f"Kept {len(df):,} products with valid kcal. Writing SQLite …")

if os.path.exists(SQLITE):
    os.remove(SQLITE)

con = sqlite3.connect(SQLITE)
con.execute("PRAGMA journal_mode = WAL")
con.execute("PRAGMA synchronous = OFF")
con.execute("""
    CREATE TABLE products (
        id            INTEGER PRIMARY KEY,
        product_name  TEXT NOT NULL,
        brands        TEXT NOT NULL DEFAULT '',
        kcal_per_100g INTEGER NOT NULL
    )
""")

batch = []
inserted = 0
for _, row in df[["product_name", "brands", "kcal_per_100g"]].iterrows():
    batch.append((str(row["product_name"]), str(row["brands"]), int(row["kcal_per_100g"])))
    if len(batch) == 50_000:
        con.executemany("INSERT INTO products (product_name, brands, kcal_per_100g) VALUES (?,?,?)", batch)
        inserted += len(batch)
        batch = []
        print(f"  {inserted:,} rows written …")

if batch:
    con.executemany("INSERT INTO products (product_name, brands, kcal_per_100g) VALUES (?,?,?)", batch)
    inserted += len(batch)

con.commit()
print(f"Building FTS5 index ({inserted:,} rows) …")

con.execute("""
    CREATE VIRTUAL TABLE products_fts USING fts5(
        product_name,
        brands,
        content=products,
        content_rowid=id,
        tokenize='unicode61'
    )
""")
con.execute("INSERT INTO products_fts(products_fts) VALUES('rebuild')")
con.commit()
con.close()

size_mb = os.path.getsize(SQLITE) / 1024 / 1024
print(f"\nDone! {SQLITE} ({size_mb:.0f} MB, {inserted:,} products, {time.time() - t0:.0f}s total)")
