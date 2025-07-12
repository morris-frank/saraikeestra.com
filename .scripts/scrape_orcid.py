import subprocess

import requests

ORCID = "0000-0002-6368-0977"
# TOKEN = "YOUR_ORCID_CLIENT_TOKEN"
# HEADERS = {"Accept": "application/json", "Authorization": f"Bearer {TOKEN}"}
HEADERS = {
    "Accept": "application/json",
}

# 1. Get all works
resp = requests.get(f"https://pub.orcid.org/v3.0/{ORCID}/works", headers=HEADERS)
resp.raise_for_status()
groups = resp.json().get("group", [])

dois = []
for g in groups:
    for wok in g.get("work-summary", []):
        ext = wok.get("external-ids", {}).get("external-id", [])
        for e in ext:
            if e.get("external-id-type", "").lower() == "doi":
                doi = e["external-id-value"]
                if doi not in dois:
                    dois.append(doi)

# 2. (Optional) confirm DOIs via Crossref
clean = []
for doi in dois:
    r = requests.get("https://api.crossref.org/works", params={"filter": f"doi:{doi}"})
    if r.status_code == 200 and r.json()["message"]["total-results"] > 0:
        clean.append(doi)

# 3. Write DOI list to file
with open("dois.txt", "w") as f:
    f.write("\n".join(clean))

# 4. Run doi2bib (assumes it's installed and in PATH)
subprocess.run(["doi2bib", "--input", "dois.txt", "--output", "refs.bib"])
