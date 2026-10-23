#!/usr/bin/env python3
"""Export the local SQLite payroll fixture as PostgreSQL-compatible SQL.

Usage:
  python3 scripts/export-sqlite-to-postgres.py --input db/custom.db --output /tmp/payroll-legacy.sql
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file /tmp/payroll-legacy.sql

The exporter preserves IDs, converts SQLite millisecond timestamps to PostgreSQL
TIMESTAMP values, orders inserts by foreign-key dependencies, and uses a
transaction so a failed import rolls back.
"""
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import sqlite3

TABLE_ORDER = [
    "PayrollRuleSet", "CompanyProfile", "Driver", "PayrollRun",
    "PayrollRuleValue", "ContractOverride", "DriverResult", "PayrollException",
    "TrafficViolation", "ManualAdjustment", "CustomBonus", "CustomDeduction",
    "AuditLog", "IncomeRecord", "ExpenseCategory", "Expense", "DriverCount",
    "CustomIncomeField",
]
TIMESTAMP_COLUMNS = {
    "effectiveFrom", "effectiveTo", "createdAt", "updatedAt", "activatedAt",
    "ticketDate",
}


def sql_value(table: str, column: str, value: object) -> str:
    if value is None:
        return "NULL"
    if column in TIMESTAMP_COLUMNS and isinstance(value, (int, float)):
        stamp = dt.datetime.fromtimestamp(value / 1000, tz=dt.timezone.utc)
        return "'" + stamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "+00'"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, bytes):
        return "decode('" + value.hex() + "','hex')"
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="db/custom.db")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = pathlib.Path(args.input)
    if not source.exists():
        raise SystemExit(f"SQLite source does not exist: {source}")

    con = sqlite3.connect(source)
    out = [
        "BEGIN;",
        "SET timezone = 'UTC';",
        "-- Generated from the local SQLite backup. Review before production use.",
    ]
    counts: list[tuple[str, int]] = []

    for table in TABLE_ORDER:
        exists = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        if not exists:
            continue
        columns = [row[1] for row in con.execute(f'PRAGMA table_info("{table}")')]
        rows = con.execute(f'SELECT * FROM "{table}"').fetchall()
        counts.append((table, len(rows)))
        if not rows:
            continue
        quoted_columns = ", ".join(f'"{column}"' for column in columns)
        for row in rows:
            values = ", ".join(
                sql_value(table, column, value)
                for column, value in zip(columns, row)
            )
            out.append(f'INSERT INTO "{table}" ({quoted_columns}) VALUES ({values});')

    out.extend([
        "COMMIT;",
        "-- Imported row counts: " + ", ".join(f"{name}={count}" for name, count in counts),
        "",
    ])
    pathlib.Path(args.output).write_text("\n".join(out), encoding="utf-8")
    print("Exported " + ", ".join(f"{name}={count}" for name, count in counts))


if __name__ == "__main__":
    main()
