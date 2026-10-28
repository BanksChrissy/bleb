#!/usr/bin/env python3
"""Validate catalog structure and safe publisher-link metadata."""
import json
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
expected = {
    "guidelines": ("id", "title", "year", "organization", "specialty", "kind", "population", "url"),
    "societies": ("id", "name", "specialty", "url"),
}
seen = set()
for name, required in expected.items():
    records = json.loads((ROOT / "data" / (name + ".json")).read_text(encoding="utf-8"))["items"]
    assert isinstance(records, list) and records, name + " has no items"
    for row in records:
        for field in required:
            assert row.get(field) not in (None, ""), name + " missing " + field
        assert row["id"] not in seen, "Duplicate ID: " + row["id"]
        seen.add(row["id"])
        url = urllib.parse.urlparse(row["url"])
        assert url.scheme == "https" and url.netloc and " " not in row["url"], "Invalid URL: " + row["url"]
        if name == "guidelines":
            assert 1900 <= row["year"] <= 2100, "Invalid year: " + str(row["year"])
    print("Validated", name, len(records))
print("Catalogs valid:", len(seen), "unique entries")
