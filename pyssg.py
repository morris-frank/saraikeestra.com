import html
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class BibAuthor:
    """Represents a single author with first and last name."""

    first_name: str
    last_name: str

    @classmethod
    def from_string(cls, author_str: str) -> "BibAuthor":
        """Parse author string like 'Keestra, Sarai M.' into Author object."""
        # Handle cases with multiple initials
        parts = author_str.strip().split(", ")
        if len(parts) != 2:
            # Fallback: treat as single name
            return cls(first_name="", last_name=author_str.strip())

        last_name, first_name = parts
        return cls(first_name=first_name.strip(), last_name=last_name.strip())

    def as_html(self, match_author: Optional[str] = None) -> str:
        author_str = f"{self.last_name}, {self.first_name}" if self.first_name else self.last_name
        if match_author and match_author.lower() in author_str.lower():
            return f"<span class='author'>{html.escape(author_str)}</span>"
        return html.escape(author_str)


@dataclass(frozen=True)
class BibEntry:
    """Base class for all bibliography entries."""

    key: str
    title: str
    authors: List[BibAuthor]
    year: int
    month: Optional[str] = None
    url: Optional[str] = None
    doi: Optional[str] = None
    publisher: Optional[str] = None
    abstract: Optional[str] = None

    @property
    def _entry_type(self) -> str:
        return "BibEntry"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BibEntry":
        """Create entry from dictionary data."""
        # Parse authors
        authors = []
        if "author" in data:
            author_list = [a.strip() for a in data["author"].split(" and ")]
            authors = [BibAuthor.from_string(author) for author in author_list]

        # Parse year
        year = int(data.get("year", 0))

        return cls(
            key=data.get("key", ""),
            title=data.get("title", ""),
            authors=authors,
            year=year,
            month=data.get("month"),
            url=data.get("url"),
            doi=data.get("doi"),
            publisher=data.get("publisher"),
            abstract=data.get("abstract"),
        )

    @property
    def _source_html(self) -> str:
        tags = []
        if self.year:
            tags.append(f"{self.year}")

        if hasattr(self, "journal") and self.journal:
            tags.append(self.journal)
        elif hasattr(self, "booktitle") and self.booktitle:
            tags.append(self.booktitle)

        if hasattr(self, "volume") and self.volume:
            if hasattr(self, "number") and self.number:
                tags.append(f"Vol. {self.volume} No. {self.number}")
            else:
                tags.append(f"Vol. {self.volume}")

        if tags:
            tags_html = "".join([f"<span class='tag'>{x}</span>" for x in tags])
            return f"<span class='tags'>{tags_html}</span>"
        return ""

    def _authors_html(self, match_author: Optional[str] = None) -> str:
        if not self.authors:
            return ""
        authors = " and ".join([author.as_html(match_author) for author in self.authors])
        return f"<div class='authors'>{authors}</div>"

    @property
    def _altmetric_html(self) -> str:
        return (
            f"""
        <aside>
            <span class="__dimensions_badge_embed__" data-doi="{self.doi}"
                data-legend="hover-right" data-style="small_circle"></span>
            <div data-badge-type='donut' class='altmetric-embed' data-badge-popover='right'
                data-doi='{html.escape(self.doi)}'></div>
        </aside>
    """
            if self.doi
            else ""
        )

    @property
    def _doi_html(self) -> str:
        return f'<a href="https://doi.org/{self.doi}" class="doi" target="_blank">{html.escape(self.doi)}</a>' if self.doi else ""

    @property
    def _abstract_html(self) -> str:
        return f'<div class="abstract">{self.abstract}</div>' if self.abstract else ""

    def as_html(self, match_author: Optional[str] = None) -> str:
        return f"""
            <div class="reference">
                {self._altmetric_html}
                <div>
                    {self._authors_html(match_author)}
                    <a href="{self.url or f'https://doi.org/{self.doi}' if self.doi else '#'}" class="title" target="_blank">
                        {html.escape(self.title)}
                    </a>
                    <div class="source">
                        {self._source_html}
                        {self._doi_html}
                    </div>
                    {self._abstract_html}
                </div>
            </div>
"""


@dataclass(frozen=True)
class BibArticle(BibEntry):
    """Represents a journal article."""

    journal: Optional[str] = None
    volume: Optional[str] = None
    number: Optional[str] = None
    pages: Optional[str] = None
    issn: Optional[str] = None

    def _entry_type(self) -> str:
        return "Article"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BibArticle":
        """Create Article from dictionary data."""
        base = BibEntry.from_dict(data)
        return cls(
            key=base.key,
            title=base.title,
            authors=base.authors,
            year=base.year,
            month=base.month,
            url=base.url,
            doi=base.doi,
            publisher=base.publisher,
            abstract=base.abstract,
            journal=data.get("journal"),
            volume=data.get("volume"),
            number=data.get("number"),
            pages=data.get("pages"),
            issn=data.get("issn"),
        )


@dataclass(frozen=True)
class BibInProceedings(BibEntry):
    """Represents a conference proceedings entry."""

    booktitle: Optional[str] = None
    pages: Optional[str] = None
    editor: Optional[str] = None

    def _entry_type(self) -> str:
        return "Proceedings"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BibInProceedings":
        """Create InProceedings from dictionary data."""
        base = BibEntry.from_dict(data)
        return cls(
            key=base.key,
            title=base.title,
            authors=base.authors,
            year=base.year,
            month=base.month,
            url=base.url,
            doi=base.doi,
            publisher=base.publisher,
            abstract=base.abstract,
            booktitle=data.get("booktitle"),
            pages=data.get("pages"),
            editor=data.get("editor"),
        )


@dataclass(frozen=True)
class BibTechReport(BibEntry):
    """Represents a technical report."""

    institution: Optional[str] = None
    type: Optional[str] = None


class BibliographyParser:
    """Parser for .bib files."""

    def __init__(self, file_path: str):
        content = Path(file_path).read_text()
        self.entries: List[BibEntry] = []

        entry_pattern = r"@(\w+)\{([^,]+),\s*(.*?)\n\}"
        entries = re.findall(entry_pattern, content, re.DOTALL)

        for entry_type, key, fields_str in entries:
            try:
                entry_data = self._parse_fields(fields_str)
                entry_data["key"] = key

                if entry_type == "article":
                    entry = BibArticle.from_dict(entry_data)
                elif entry_type == "inproceedings":
                    entry = BibInProceedings.from_dict(entry_data)
                elif entry_type == "techreport":
                    entry = BibTechReport.from_dict(entry_data)
                else:
                    # For unknown types, create a generic article
                    entry = BibArticle.from_dict(entry_data)

                self.entries.append(entry)

            except Exception as e:
                print(f"Warning: Could not parse entry {key}: {e}")
                continue

        self.entries.sort(key=lambda x: x.year, reverse=True)

    def _parse_fields(self, fields_str: str) -> Dict[str, str]:
        """Parse the fields string into a dictionary."""
        fields = {}

        # Pattern to match field = {value} or field = value
        field_pattern = r"(\w+)\s*=\s*\{([^}]*)\}|(\w+)\s*=\s*([^,\n]+)"
        matches = re.findall(field_pattern, fields_str)

        for match in matches:
            if match[0]:  # field = {value} format
                field_name = match[0].strip()
                field_value = match[1].strip()
            else:  # field = value format
                field_name = match[2].strip()
                field_value = match[3].strip()

            # Clean up the value
            field_value = field_value.strip("{}").strip()
            fields[field_name] = field_value

        return fields


class StaticSiteGenerator:
    """Generates static HTML site from bibliography data."""

    def __init__(self, config_path: str = "config.toml"):
        self.config = tomllib.loads(Path(config_path).read_text())

        self.layout = Path(self.config["layout-file"]).read_text()
        self.style = Path(self.config["style-file"]).read_text()

        self.bib_parser = BibliographyParser(self.config["reference-file"])

    def _generate_bibliography_html(self) -> str:
        """Generate HTML for bibliography entries."""
        entries_by_year = {}
        for entry in self.bib_parser.entries:
            year = entry.year
            if year not in entries_by_year:
                entries_by_year[year] = []
            entries_by_year[year].append(entry)

        # Generate HTML for each year
        html_parts = []
        for year in sorted(entries_by_year.keys(), reverse=True):
            year_entries = entries_by_year[year]
            html_parts.append(f"<section>")
            html_parts.append(f"<h2>{year}</h2>")

            for entry in year_entries:
                html_parts.append(entry.as_html(match_author=self.config["author"]))

            html_parts.append("</section>")

        return "\n".join(html_parts)

    def build_site(self) -> None:
        """Build the complete static site."""
        print("Building static site...")
        # Generate bibliography HTML
        bibliography_html = self._generate_bibliography_html()

        # Insert CSS into head
        css_tag = f"<style>\n{self.style}\n</style>"
        layout_html = self.layout.replace("</head>", f"{css_tag}\n</head>")

        # Insert bibliography into main
        layout_html = layout_html.replace("<main>", f"<main>\n{bibliography_html}")

        # Write output file
        with open(self.config["output-file"], "w", encoding="utf-8") as f:
            f.write(layout_html)

        print(f"Site built successfully: {self.config['output-file']}")


def main():
    """Main function to build the static site."""
    try:
        generator = StaticSiteGenerator()
        generator.build_site()
    except Exception as e:
        print(f"Error building site: {e}")
        return 1
    return 0


if __name__ == "__main__":
    exit(main())
