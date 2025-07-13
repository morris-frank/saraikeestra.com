#! /usr/bin/env python3
import glob
import hashlib
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
    topic: Optional[str] = None

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
            topic=data.get("topic"),
        )

    @property
    def _source_html(self) -> str:
        source = None
        if hasattr(self, "journal") and self.journal:
            source = self.journal
        elif hasattr(self, "booktitle") and self.booktitle:
            source = self.booktitle

        if source:
            if hasattr(self, "volume") and self.volume:
                if hasattr(self, "number") and self.number:
                    source = f"{source} | Vol. {self.volume} No. {self.number}"
                else:
                    source = f"{source} | Vol. {self.volume}"

        if source:
            return f"<span class='source'>{source}</span>"
        return ""

    def _authors_html(self, match_author: Optional[str] = None) -> str:
        if not self.authors:
            return "<div class='authors'></div>"

        # Find the index of the matched author
        matched_index = None
        if match_author:
            for i, author in enumerate(self.authors):
                author_str = f"{author.last_name}, {author.first_name}" if author.first_name else author.last_name
                if match_author.lower() in author_str.lower():
                    matched_index = i
                    break

        if matched_index is None:
            # No matched author, use simple fading
            author_elements = []
            for i, author in enumerate(self.authors):
                if i == 0 or i == len(self.authors) - 1:
                    visibility_class = "author-visible"
                elif i == 1 and len(self.authors) > 2:
                    visibility_class = "author-fade-near"
                else:
                    visibility_class = "author-fade-far"

                author_html = author.as_html(match_author)
                if visibility_class != "author-visible":
                    if "<span class='author'>" in author_html:
                        author_html = author_html.replace("<span class='author'>", f"<span class='author {visibility_class}'>")
                    else:
                        author_html = f"<span class='{visibility_class}'>{author_html}</span>"

                author_elements.append(author_html)

            authors_html = " and ".join(author_elements)
            return f"<div class='authors single-line'>{authors_html}</div>"

        # Build left and right author lists
        left_authors = []
        right_authors = []

        for i, author in enumerate(self.authors):
            if i < matched_index:
                left_authors.append(author)
            elif i > matched_index:
                right_authors.append(author)

        # Create left fading text
        left_html = ""
        if left_authors:
            left_elements = []
            for i, author in enumerate(left_authors):
                # Fade from left to right (towards matched author)
                fade_level = (i + 1) / len(left_authors) if len(left_authors) > 0 else 1
                if fade_level > 0.7:
                    visibility_class = "author-fade-near"
                else:
                    visibility_class = "author-fade-far"

                author_html = author.as_html(match_author)
                if "<span class='author'>" in author_html:
                    author_html = author_html.replace("<span class='author'>", f"<span class='author {visibility_class}'>")
                else:
                    author_html = f"<span class='{visibility_class}'>{author_html}</span>"

                left_elements.append(author_html)

            left_html = " and ".join(left_elements)
            if left_html:
                left_html += " and "

        # Create right fading text
        right_html = ""
        if right_authors:
            right_elements = []
            for i, author in enumerate(right_authors):
                # Fade from right to left (towards matched author)
                fade_level = (len(right_authors) - i) / len(right_authors) if len(right_authors) > 0 else 1
                if fade_level > 0.7:
                    visibility_class = "author-fade-near"
                else:
                    visibility_class = "author-fade-far"

                author_html = author.as_html(match_author)
                if "<span class='author'>" in author_html:
                    author_html = author_html.replace("<span class='author'>", f"<span class='author {visibility_class}'>")
                else:
                    author_html = f"<span class='{visibility_class}'>{author_html}</span>"

                right_elements.append(author_html)

            right_html = " and ".join(right_elements)
            if right_html:
                right_html = " and " + right_html

        # Get matched author HTML
        matched_author = self.authors[matched_index]
        matched_html = matched_author.as_html(match_author)

        # Calculate position percentage for matched author
        position_percentage = (matched_index / (len(self.authors) - 1)) * 100 if len(self.authors) > 1 else 50

        return f"""
            <div class='authors single-line'>
                <div class='authors-left'>{left_html}</div>
                <div class='authors-matched' style='left: {position_percentage}%'>{matched_html}</div>
                <div class='authors-right'>{right_html}</div>
            </div>"""

    @property
    def _altmetric_html(self) -> str:
        return (
            f"""<span class="__dimensions_badge_embed__" data-doi="{self.doi}"
                data-legend="hover-right" data-style="small_circle"></span>
            <div data-badge-type='donut' class='altmetric-embed' data-badge-popover='right'
                data-doi='{html.escape(self.doi)}'></div>"""
            if self.doi
            else ""
        )

    @property
    def _doi_html(self) -> str:
        return f'<a href="https://doi.org/{self.doi}" class="doi" target="_blank">{html.escape(self.doi)}</a>' if self.doi else ""

    @property
    def _abstract_html(self) -> str:
        if not self.abstract:
            return ""

        # Truncate abstract for preview
        preview_length = 200
        is_truncated = len(self.abstract) > preview_length
        preview_text = self.abstract[:preview_length] + "..." if is_truncated else self.abstract

        truncated_class = " truncated" if is_truncated else ""
        toggle_button = ""

        if is_truncated:
            toggle_button = f"""
                <span class="abstract-toggle" onclick="toggleAbstract(this)">
                    Show more
                </span>"""

        return f"""
            <div class="abstract-container">
                <div class="abstract{truncated_class}" data-full-text="{html.escape(self.abstract)}">
                    {html.escape(preview_text)}
                </div>
                {toggle_button}
            </div>"""

    @property
    def _year_html(self) -> str:
        return f"<span class='year'>{self.year}</span>" if self.year else ""

    def as_html(self, match_author: Optional[str] = None, topic: Optional[str] = None) -> str:
        has_score = self.doi and self.doi.startswith("10.")
        return f"""
            <div class="reference {'with-score' if has_score else 'no-score'}" style="order: 200;" data-topic="{topic or 'None'}">
                <aside>
                    {self._year_html}
                    {self._altmetric_html}
                    <div></div>
                </aside>
                <main>
                    <div class="source">
                        {self._source_html}
                        {self._doi_html}
                    </div>
                    {self._authors_html(match_author)}
                    <a href="{self.url or f'https://doi.org/{self.doi}' if self.doi else '#'}" class="title" target="_blank">
                        {html.escape(self.title)}
                    </a>
                    {self._abstract_html}
                </main>
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
            topic=base.topic,
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
            topic=base.topic,
            booktitle=data.get("booktitle"),
            pages=data.get("pages"),
            editor=data.get("editor"),
        )


@dataclass(frozen=True)
class BibTechReport(BibEntry):
    """Represents a technical report."""

    institution: Optional[str] = None
    type: Optional[str] = None

    def _entry_type(self) -> str:
        return "TechReport"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BibTechReport":
        """Create TechReport from dictionary data."""
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
            topic=base.topic,
            institution=data.get("institution"),
            type=data.get("type"),
        )


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

    @property
    def topics_html(self) -> List[str]:
        topic_descriptions = {
            "Human Biology & Development": "Research on human biology and development, including health, nutrition, and disease prevention.",
            "Global Health & Health Technology Access": "Research on global health and access to health technologies, including vaccines, diagnostics, and treatments.",
            "Clinical Trial Transparency & Research Ethics": "Research on clinical trial transparency and research ethics, including trial registration and reporting.",
        }

        topics = set([e.topic for e in self.entries if e.topic])
        filter_html = '<section class="topic-filters">\n'
        for topic in sorted(list(topics)):
            desc = topic_descriptions.get(topic, f"Publications related to {topic}")
            filter_html += f'<div class="topic-filter active" data-topic="{html.escape(topic)}">\n'
            filter_html += f"<h4>{html.escape(topic)}</h4>\n"
            filter_html += f"<p>{html.escape(desc)}</p>\n"
            filter_html += "</div>\n"
        filter_html += "</section>\n"
        return filter_html


class StaticSiteGenerator:
    """Generates static HTML site from bibliography data."""

    def __init__(self, config_path: str = "config.toml"):
        self.config = tomllib.loads(Path(config_path).read_text())
        self.bib_parser = BibliographyParser(self.config["reference-file"])

    @property
    def layout(self) -> str:
        return Path(self.config["layout-file"]).read_text()

    @property
    def style(self) -> str:
        """Concatenate all CSS files in the ./css folder and create a hash-based filename."""
        css_folder = Path(self.config["style-folder"])

        # Find all CSS files in the css folder
        css_files = list(css_folder.glob("*.css"))
        if not css_files:
            raise RuntimeWarning(f"Warning: No CSS files found in {css_folder} folder")

        # Sort files for consistent ordering
        css_files.sort()
        print(css_files)

        # Concatenate all CSS content
        concatenated_css = ""
        for css_file in css_files:
            concatenated_css += f"""/* {css_file.name} */
{css_file.read_text(encoding="utf-8")}

"""

        css_hash = hashlib.md5(concatenated_css.encode("utf-8")).hexdigest()[:8]
        hash_filename = Path(f"style-{css_hash}.css")

        for existing_file in Path(".").glob("style-*.css"):
            existing_file.unlink()
            print(f"Deleted existing CSS file: {existing_file}")

        hash_filename.write_text(concatenated_css)

        return concatenated_css

    def _generate_bibliography_html(self) -> str:
        # Generate header section with image and research description
        header_html = """
        <section class="research-header">
            <div class="header-content">
                <div class="header-image">
                    <img src="sarai.jpg" alt="Sarai Keestra" class="profile-image">
                </div>
                <div class="header-text">
                    <h1>Sarai Keestra</h1>
                    <p class="research-description">
                        I am a researcher focused on human biology, global health, and research ethics. My work spans three main areas:
                    </p>
                    <div class="research-areas">
                        <div class="research-area">
                            <h3>Human Biology & Development</h3>
                            <p>Investigating neurodevelopmental outcomes, thyroid function, and developmental processes across different populations and environmental contexts.</p>
                        </div>
                        <div class="research-area">
                            <h3>Global Health & Health Technology Access</h3>
                            <p>Examining barriers to equitable access to health technologies, including vaccines and treatments, particularly in low-resource settings.</p>
                        </div>
                        <div class="research-area">
                            <h3>Clinical Trial Transparency & Research Ethics</h3>
                            <p>Advocating for improved transparency in clinical trials and ensuring research practices prioritize public health and ethical standards.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        """

        # Generate segmented topic filter
        filter_html = "<h2>Publications</h2>\n"
        filter_html += self.bib_parser.topics_html

        # Generate bibliography entries with topic data attributes
        html_parts = ["<section>"]
        for entry in self.bib_parser.entries:
            html_parts.append(entry.as_html(match_author=self.config["author"], topic=entry.topic))
        html_parts.append("</section>")

        return header_html + filter_html + "".join(html_parts)

    def build_site(self) -> None:
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
