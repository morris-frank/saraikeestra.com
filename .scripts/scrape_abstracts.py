#!/usr/bin/env python3
"""
Abstract Scraper for Bibliography

This script scrapes abstracts from DOIs using various APIs and adds them to the bibliography.
Uses only the standard library and common APIs for retrieving publication metadata.
"""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional

from pyssg import BibArticle, BibInProceedings, BibliographyParser


class AbstractScraper:
    """Scraper for abstracts from various sources."""

    def __init__(self):
        self.session_headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        self.rate_limit_delay = 1  # seconds between requests

    def extract_doi_from_url(self, url: str) -> Optional[str]:
        """Extract DOI from various URL formats."""
        if not url:
            return None

        # Handle direct DOI URLs
        doi_patterns = [r"https?://doi\.org/(.+)", r"https?://dx\.doi\.org/(.+)", r"doi\.org/(.+)", r"10\.\d{4,}/[^\s]+"]

        for pattern in doi_patterns:
            match = re.search(pattern, url)
            if match:
                doi = match.group(1)
                # Clean up the DOI
                doi = doi.split("?")[0].split("#")[0].rstrip("/")
                return doi

        return None

    def get_abstract_from_crossref(self, doi: str) -> Optional[str]:
        """Get abstract from Crossref API."""
        try:
            url = f"https://api.crossref.org/works/{doi}"
            req = urllib.request.Request(url, headers=self.session_headers)

            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode("utf-8"))

                if "message" in data and "abstract" in data["message"]:
                    abstract = data["message"]["abstract"]
                    if abstract:
                        return abstract.strip()

                return None

        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError) as e:
            print(f"Crossref API error for {doi}: {e}")
            return None

    def get_abstract_from_semantic_scholar(self, doi: str) -> Optional[str]:
        """Get abstract from Semantic Scholar API."""
        try:
            url = f"https://api.semanticscholar.org/graph/v1/paper/{doi}?fields=abstract"
            req = urllib.request.Request(url, headers=self.session_headers)

            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode("utf-8"))

                if "abstract" in data and data["abstract"]:
                    return data["abstract"].strip()

                return None

        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError) as e:
            print(f"Semantic Scholar API error for {doi}: {e}")
            return None

    def get_abstract_from_arxiv(self, doi: str) -> Optional[str]:
        """Get abstract from arXiv API (for arXiv DOIs)."""
        if not doi.startswith("10.48550/arXiv."):
            return None

        try:
            arxiv_id = doi.replace("10.48550/arXiv.", "")
            url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
            req = urllib.request.Request(url, headers=self.session_headers)

            with urllib.request.urlopen(req) as response:
                content = response.read().decode("utf-8")

                # Simple XML parsing for abstract
                abstract_match = re.search(r"<summary>(.*?)</summary>", content, re.DOTALL)
                if abstract_match:
                    abstract = abstract_match.group(1).strip()
                    # Clean up HTML entities
                    abstract = abstract.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
                    return abstract

                return None

        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            print(f"arXiv API error for {doi}: {e}")
            return None

    def get_abstract_from_biorxiv(self, doi: str) -> Optional[str]:
        """Get abstract from bioRxiv API."""
        if not doi.startswith("10.1101/"):
            return None

        try:
            # bioRxiv API endpoint
            url = f"https://api.biorxiv.org/details/biorxiv/{doi}"
            req = urllib.request.Request(url, headers=self.session_headers)

            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode("utf-8"))

                if "collection" in data and len(data["collection"]) > 0:
                    abstract = data["collection"][0].get("abstract", "")
                    if abstract:
                        return abstract.strip()

                return None

        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError) as e:
            print(f"bioRxiv API error for {doi}: {e}")
            return None

    def scrape_abstract(self, doi: str) -> Optional[str]:
        """Try multiple sources to get the abstract for a DOI."""
        if not doi:
            return None

        print(f"Scraping abstract for DOI: {doi}")

        # Try different sources in order of preference
        sources = [
            ("Crossref", self.get_abstract_from_crossref),
            ("Semantic Scholar", self.get_abstract_from_semantic_scholar),
            ("bioRxiv", self.get_abstract_from_biorxiv),
            ("arXiv", self.get_abstract_from_arxiv),
        ]

        for source_name, source_func in sources:
            try:
                abstract = source_func(doi)
                if abstract:
                    print(f"  ✓ Found abstract from {source_name}")
                    return abstract
                else:
                    print(f"  ✗ No abstract found from {source_name}")
            except Exception as e:
                print(f"  ✗ Error with {source_name}: {e}")

            # Rate limiting
            time.sleep(self.rate_limit_delay)

        print(f"  ✗ No abstract found from any source")
        return None


def add_abstracts_to_bibliography(bib_file: str, output_file: str) -> None:
    """Add abstracts to bibliography entries."""

    # Parse the bibliography
    parser = BibliographyParser()
    entries = parser.parse_file(bib_file)

    # Initialize scraper
    scraper = AbstractScraper()

    # Track progress
    total_entries = len(entries)
    entries_with_doi = [e for e in entries if e.doi]
    entries_without_abstract = [e for e in entries_with_doi if not hasattr(e, "abstract") or not e.abstract]

    print(f"Total entries: {total_entries}")
    print(f"Entries with DOI: {len(entries_with_doi)}")
    print(f"Entries needing abstracts: {len(entries_without_abstract)}")
    print()

    # Create a new list to store entries with abstracts
    updated_entries = []
    abstracts_found = 0

    for i, entry in enumerate(entries, 1):
        print(f"Processing entry {i}/{total_entries}: {entry.title[:60]}...")

        # Check if entry already has an abstract
        if hasattr(entry, "abstract") and entry.abstract:
            print(f"  ✓ Entry already has abstract")
            updated_entries.append(entry)
            continue

        # Try to get abstract
        abstract = None
        if entry.doi:
            abstract = scraper.scrape_abstract(entry.doi)
            if abstract:
                abstracts_found += 1

        # Create updated entry with abstract
        if isinstance(entry, BibArticle):
            updated_entry = BibArticle(
                key=entry.key,
                title=entry.title,
                authors=entry.authors,
                year=entry.year,
                month=entry.month,
                url=entry.url,
                doi=entry.doi,
                publisher=entry.publisher,
                journal=entry.journal,
                volume=entry.volume,
                number=entry.number,
                pages=entry.pages,
                issn=entry.issn,
                abstract=abstract,
            )
        elif isinstance(entry, BibInProceedings):
            updated_entry = BibInProceedings(
                key=entry.key,
                title=entry.title,
                authors=entry.authors,
                year=entry.year,
                month=entry.month,
                url=entry.url,
                doi=entry.doi,
                publisher=entry.publisher,
                booktitle=entry.booktitle,
                pages=entry.pages,
                editor=entry.editor,
                abstract=abstract,
            )
        else:
            # For base entries, create a new Article with abstract
            updated_entry = BibArticle(
                key=entry.key,
                title=entry.title,
                authors=entry.authors,
                year=entry.year,
                month=entry.month,
                url=entry.url,
                doi=entry.doi,
                publisher=entry.publisher,
                abstract=abstract,
            )

        updated_entries.append(updated_entry)
        print()

    # Update the parser's entries
    parser.entries = updated_entries

    # Export to JSON with abstracts
    json_output = parser.to_json(output_file)

    print(f"\n=== Summary ===")
    print(f"Total entries processed: {total_entries}")
    print(f"Abstracts found: {abstracts_found}")
    print(f"Success rate: {abstracts_found/len(entries_without_abstract)*100:.1f}%" if entries_without_abstract else "100%")
    print(f"Updated bibliography saved to: {output_file}")


def update_html_with_abstracts(bib_file: str, html_file: str, output_html: str) -> None:
    """Update HTML bibliography to include abstracts."""

    # Parse bibliography with abstracts
    parser = BibliographyParser()
    entries = parser.parse_file(bib_file)

    # Read the existing HTML
    with open(html_file, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Find and replace each reference entry to include abstract
    for entry in entries:
        if hasattr(entry, "abstract") and entry.abstract:
            # Create abstract HTML
            abstract_html = f"""
                    <div class="abstract">
                        <strong>Abstract:</strong> {entry.abstract}
                    </div>"""

            # Find the reference div and add abstract before the closing div
            # This is a simple approach - in practice you might want more robust HTML parsing
            reference_pattern = f'<div class="reference"[^>]*data-title="{entry.title.lower()}"[^>]*>'

            # For now, we'll add the abstract to the JSON and regenerate the HTML
            # This is more reliable than trying to parse and modify existing HTML

    # Instead of modifying HTML directly, let's regenerate it with abstracts
    from generate_bibliography_html import generate_bibliography_html

    generate_bibliography_html(bib_file, output_html, "Sarai Keestra - Publications with Abstracts")


def main():
    """Main function to scrape abstracts and update bibliography."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scrape_abstracts.py <bib_file> [output_file]")
        print("Example: python scrape_abstracts.py references.bib references_with_abstracts.json")
        sys.exit(1)

    bib_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "references_with_abstracts.json"

    try:
        print("Starting abstract scraping...")
        add_abstracts_to_bibliography(bib_file, output_file)

        # Also update the HTML if it exists
        import os

        html_file = "bibliography.html"
        if os.path.exists(html_file):
            print(f"\nUpdating HTML bibliography...")
            update_html_with_abstracts(output_file, html_file, "bibliography_with_abstracts.html")
            print("Updated HTML saved to: bibliography_with_abstracts.html")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
