#!/usr/bin/env python3
"""Check official publisher links for transport-level availability, not clinical currency.

Publisher robots rules and bot protection can make a valid page return 403 or 429;
those cases are marked 'blocked', never 'broken'. Only HTTP 404/410 are listed
as potentially broken and still require human confirmation.
"""
import concurrent.futures
import datetime as dt
import json
import pathlib
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
URLS = []
for source in ("guidelines", "societies"):
    catalog = json.loads((ROOT / "data" / (source + ".json")).read_text(encoding="utf-8"))
    URLS.extend((row["id"], row["url"]) for row in catalog["items"])

HEADERS = {
    "User-Agent": "ClinicalGuidelineAtlas/1.0 link-audit (+https://github.com/BanksChrissy/bleb)",
    "Accept": "text/html,application/pdf,*/*",
}

def check_one(pair):
    ident, url = pair
    if not url.startswith("https://"):
        return ident, {"status": "unverified", "http": None}
    for method in ("HEAD", "GET"):
        request = urllib.request.Request(url, headers=HEADERS, method=method)
        if method == "GET":
            request.add_header("Range", "bytes=0-0")
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                code = response.status
                return ident, {"status": "reachable" if 200 <= code < 400 else "unverified", "http": code}
        except urllib.error.HTTPError as error:
            code = error.code
            if method == "HEAD" and code in (400, 405, 501):
                continue
            if code in (401, 403, 407, 429):
                return ident, {"status": "blocked", "http": code}
            if code in (404, 410):
                return ident, {"status": "possible-broken", "http": code}
            return ident, {"status": "unverified", "http": code}
        except (urllib.error.URLError, TimeoutError, OSError):
            if method == "HEAD":
                continue
            return ident, {"status": "unverified", "http": None}
    return ident, {"status": "unverified", "http": None}

def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(pool.map(check_one, URLS))
    output = {
        "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "explanation": "Checks transport accessibility only; not publication currency or scientific validity. 403/429 are publisher restrictions, not confirmed broken links.",
        "results": dict(sorted(results.items())),
    }
    destination = ROOT / "data" / "link-status.json"
    destination.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    summary = {key: sum(v["status"] == key for v in results.values())
               for key in ("reachable", "blocked", "possible-broken", "unverified")}
    print("Audited", len(results), "links:", summary)

if __name__ == "__main__":
    main()
