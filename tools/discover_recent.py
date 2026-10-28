#!/usr/bin/env python3
"""Find *candidate* recently published practice guidelines via NCBI PubMed.

Not a vetted guideline list; does not automatically replace, update, or endorse
any curated entry. PubMed publication-type indexing may be incomplete/delayed.
"""
import datetime as dt
import html
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROOT_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
HEADERS = {"User-Agent": "ClinicalGuidelineAtlas/1.0 (+https://github.com/BanksChrissy/bleb)"}
DAYS = 90

def api(endpoint, params):
    url = ROOT_URL + endpoint + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)

def main():
    today = dt.datetime.now(dt.timezone.utc)
    try:
        search = api("esearch.fcgi", {
            "db": "pubmed",
            "term": '"Practice Guideline"[Publication Type]',
            "reldate": DAYS,
            "datetype": "pdat",
            "sort": "pub date",
            "retmax": 40,
            "retmode": "json",
            "tool": "clinical_guideline_atlas",
        })
        ids = search.get("esearchresult", {}).get("idlist", [])
        time.sleep(0.5)
        details = api("esummary.fcgi", {
            "db": "pubmed", "id": ",".join(ids), "retmode": "json",
            "tool": "clinical_guideline_atlas",
        }) if ids else {"result": {}}
    except (OSError, ValueError, KeyError) as error:
        print("Discovery skipped; keeping previously saved data:", error)
        return
    rows = []
    for uid in ids:
        if not uid.isdigit():
            continue
        item = details.get("result", {}).get(uid, {})
        title = html.unescape(re.sub(r"<[^>]+>", "", item.get("title", ""))).strip()
        if not title:
            continue
        date = item.get("pubdate", "")
        year_match = re.search(r"\b(?:19|20)\d{2}\b", date)
        rows.append({
            "id": "pubmed-" + uid,
            "title": title,
            "year": int(year_match.group(0)) if year_match else None,
            "organization": item.get("fulljournalname", "Journal not listed"),
            "specialty": "Unreviewed publication",
            "topic": "Practice guideline",
            "kind": "PubMed candidate",
            "population": "Not independently assessed",
            "url": "https://pubmed.ncbi.nlm.nih.gov/" + uid + "/",
            "note": "Automatically indexed PubMed publication. Verify guideline issuer, applicability, status and publisher full text.",
            "verifiedAt": None,
        })
    output = {
        "discoveredAt": today.isoformat(timespec="seconds"),
        "source": "NCBI PubMed E-utilities",
        "windowDays": DAYS,
        "disclaimer": "Automatically discovered records; NOT verified or recommended, and not a comprehensive or continuously updated list.",
        "items": rows,
    }
    path = ROOT / "data" / "recent.json"
    path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("PubMed candidates:", len(rows))

if __name__ == "__main__":
    main()
