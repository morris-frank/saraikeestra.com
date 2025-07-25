#! /usr/bin/env python3
from __future__ import annotations

import hashlib
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


class HTMLElement:
    def __init__(self, tag: str, children: Children, **kwargs):
        self.tag = tag
        self.children = children
        self.kwargs = kwargs

    @classmethod
    def _format_arg_key(cls, key: str) -> str:
        if key == "cls":
            return "class"
        return f"{key}" if key.startswith("_") else f"{key.replace('_', '-')}"

    @classmethod
    def _format_kwargs(cls, kwargs: Dict[str, Any]) -> str:
        return " ".join([f'{cls._format_arg_key(k)}="{v}"' for k, v in kwargs.items()])

    @classmethod
    def _format_children(cls, children: Children) -> str:
        if isinstance(children, list):
            return "".join([cls._format_children(child) for child in children])
        else:
            return str(children) if children is not None else ""

    def __str__(self):
        return f"<{self.tag} {HTMLElement._format_kwargs(kwargs=self.kwargs)}>{HTMLElement._format_children(children=self.children)}</{self.tag}>"


Children = HTMLElement | List[HTMLElement] | str | None


class Div(HTMLElement):
    def __init__(self, children: Children, **kwargs):
        super().__init__("div", children, **kwargs)


class A(HTMLElement):
    def __init__(self, text: Children, *, href: str, **kwargs):
        super().__init__("a", [text], href=href, **{"target": "_blank", **kwargs})


class Img(HTMLElement):
    def __init__(self, src: str, alt: str, **kwargs):
        super().__init__("img", None, src=src, alt=alt, **kwargs)


class Span(HTMLElement):
    def __init__(self, text: Any, **kwargs):
        super().__init__("span", [text], **kwargs)


class P(HTMLElement):
    def __init__(self, text: Any, **kwargs):
        super().__init__("p", [text], **kwargs)


class H2(HTMLElement):
    def __init__(self, text: Any, **kwargs):
        super().__init__("h2", [text], **kwargs)


class H3(HTMLElement):
    def __init__(self, text: Any, **kwargs):
        super().__init__("h3", [text], **kwargs)


class H4(HTMLElement):
    def __init__(self, text: Any, **kwargs):
        super().__init__("h4", [text], **kwargs)


class Section(HTMLElement):
    def __init__(self, children: Children, **kwargs):
        super().__init__("section", children, **kwargs)


@dataclass(frozen=True)
class LayoutConfig:
    folder: str
    skeleton: str
    output: str


@dataclass(frozen=True)
class ReferencesConfig:
    author: str
    file: str
    topics: Dict[str, str]

    @classmethod
    def topics_class_name(cls, topic: str) -> str:
        return topic.split("&")[0].strip().replace(" ", "-").lower()


@dataclass(frozen=True)
class EducationConfig:
    degree: str
    institution: str
    years: str
    supervisors: Optional[List[str]] = None
    thesis: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None


@dataclass(frozen=True)
class FeaturedMediaConfig:
    name: str
    logo: str
    url: str


@dataclass(frozen=True)
class NemoLinkConfig:
    title: str
    title_en: str
    year: int
    url: str


@dataclass(frozen=True)
class NemoConfig:
    logo: str
    title: str
    description: str
    url: str
    links: List[NemoLinkConfig]


@dataclass(frozen=True)
class MediaConfig:
    title: str
    outlet: str
    year: int
    url: str


@dataclass(frozen=True)
class Config:
    """Configuration for the static site generator."""

    layout: LayoutConfig
    references: ReferencesConfig
    education: List[EducationConfig]
    featured_media: List[FeaturedMediaConfig]
    nemo: NemoConfig
    media: List[MediaConfig]

    @classmethod
    def from_toml(cls, config_path: str) -> "Config":
        """Create Config from TOML file."""
        config_data = tomllib.loads(Path(config_path).read_text())
        return cls(
            layout=LayoutConfig(**config_data["layout"]),
            references=ReferencesConfig(**config_data["references"]),
            education=[EducationConfig(**education) for education in config_data["education"]],
            featured_media=[FeaturedMediaConfig(**featured_media) for featured_media in config_data["featured_media"]],
            nemo=NemoConfig(**config_data["nemo"], links=[NemoLinkConfig(**link) for link in config_data["nemo_links"]]),
            media=[MediaConfig(**media) for media in config_data["media"]],
        )


@dataclass(frozen=True)
class BibAuthor:
    """Represents a single author with first and last name."""

    first_name: Optional[str]
    last_name: str

    @classmethod
    def from_string(cls, author_str: str) -> BibAuthor:
        """Parse author string like 'Keestra, Sarai M.' into Author object."""
        # Handle cases with multiple initials
        parts = author_str.strip().split(", ")
        if len(parts) != 2:
            # Fallback: treat as single name
            return cls(first_name="", last_name=author_str.strip())

        last_name, first_name = parts
        return cls(first_name=first_name.strip(), last_name=last_name.strip())

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}" if self.first_name else self.last_name


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

    def _source_html(self) -> Children:
        source = ""
        if hasattr(self, "journal") and self.journal:
            source = self.journal
        elif hasattr(self, "booktitle") and self.booktitle:
            source = self.booktitle
        if hasattr(self, "volume") and self.volume:
            source += f" | Vol. {self.volume}"
        if hasattr(self, "number") and self.number:
            source += f" | No. {self.number}"
        return [
            Span(source),
        ]

    def _title_html(self) -> Children:
        return [A(self.title, href=self.url or f"https://doi.org/{self.doi}"), Span(self.doi)]

    def _authors_html(self, match_author: str) -> Children:
        if not self.authors:
            return None

        # Find the index of the matched author
        matched_index = None
        for i, author in enumerate(self.authors):
            if match_author.lower() in str(author).lower():
                matched_index = i
                break

        expands = len(self.authors) > 3

        authors = []
        for i, author in enumerate(self.authors):
            is_match = i == matched_index
            is_first = i == 0
            is_last = i == len(self.authors) - 1
            if is_match:
                visibility_class = "author-match"
            elif not expands or is_first or is_last:
                visibility_class = "author-visible"
            else:
                visibility_class = "author-toggle"

            author_html = str(author)
            if not is_last:
                author_html += ","

            if is_last and expands and not is_match:
                authors.append(Span("...", cls="author-ellipsis"))
            authors.append(Span(author_html, cls=visibility_class))
            if is_first and expands and not is_match:
                authors.append(Span("...", cls="author-ellipsis"))

        return authors

    def _badges_html(self) -> Children:
        return (
            [
                Span(None, cls="__dimensions_badge_embed__", data_doi=self.doi, data_legend="hover-right", data_style="small_circle"),
                Div(None, cls="altmetric-embed", data_badge_type="donut", data_badge_popover="right", data_doi=self.doi),
                A(
                    None,
                    href=f"https://plu.mx/plum/a/?doi={self.doi}",
                    cls="plumx-plum-print-popup",
                    data_popup="right",
                    data_size="medium",
                    data_site="plum",
                    data_hide_when_empty="true",
                ),
            ]
            if self.doi
            else None
        )

    def as_html(self, match_author: Optional[str] = None) -> Children:
        has_score = self.doi and self.doi.startswith("10.")
        score_class = "with-score" if has_score else "no-score"

        authors_html = self._authors_html(match_author)
        authors_expandable = len(self.authors) > 3

        return Div(
            [
                Div(self.year, cls=f"year"),
                Div(self._source_html(), cls=f"source"),
                Span(self.topic, cls="topic"),
                Div(self._title_html(), cls="title"),
                Div(self._badges_html(), cls="badges"),
                Div(authors_html, cls=f"authors {'' if authors_expandable else 'expanded'}", onClick="this.classList.add('expanded')"),
                Div(Div(self.abstract), cls="abstract"),
            ],
            cls=f"reference {score_class} {ReferencesConfig.topics_class_name(self.topic)}",
            style=f"order: 200;",
        )


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

    def __init__(self, config: ReferencesConfig):
        self.config = config
        content = Path(config.file).read_text()
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

    def _topics_html(self) -> Children:
        return [
            Div(
                [
                    Span(
                        topic,
                        cls=f"active {ReferencesConfig.topics_class_name(topic)}",
                        data_topic=ReferencesConfig.topics_class_name(topic),
                    )
                    for topic in self.config.topics.keys()
                ],
                cls="topic-tags",
            ),
        ] + [
            P(
                desc,
                cls=f"topic-desc hidden {ReferencesConfig.topics_class_name(topic)}",
            )
            for topic, desc in self.config.topics.items()
        ]

    def as_html(self) -> Children:
        return Section(
            [
                H2("Publications"),
                self._topics_html(),
                *[entry.as_html(match_author=self.config.author) for entry in self.entries],
            ]
        )


class StaticSiteGenerator:
    """Generates static HTML site from bibliography data."""

    def __init__(self, config_path: str = "config.toml"):
        self.config = Config.from_toml(config_path)
        self.bib_parser = BibliographyParser(self.config.references)

    def _science_communication_html(self):
        # --- Featured Media Bar ---
        featured_media_items = []
        for media in self.config.featured_media:
            featured_media_items.append(
                A(
                    Img(f"logos/{media.logo}", alt=media.name + " logo"),
                    href=media.url,
                )
            )
        featured_media_block = Div(
            featured_media_items,
            cls="featured-media",
        )

        # --- NEMO Kennislink Highlight Box ---
        nemo_items = []
        for link in self.config.nemo.links:
            nemo_items.extend(
                [
                    Div(
                        [
                            A(link.title_en, href=link.url),
                            Span(f"{link.year}"),
                        ],
                    ),
                    A(link.title, href=link.url),
                ]
            )
        nemo_block = Div(
            [
                A(Img(f"logos/{self.config.nemo.logo}", alt="NEMO Kennislink logo"), href=self.config.nemo.url),
                P(self.config.nemo.description),
                *nemo_items,
            ],
            cls="nemo-box",
        )

        # Media interviews
        media_items = [
            Div(
                [
                    A(media.title, href=media.url) if media.url else Span(media.title),
                    Div(
                        [
                            Span(media.outlet),
                            Span(media.year),
                        ]
                    ),
                ],
            )
            for media in self.config.media
        ]
        media_block = Div(
            [
                H3("Media appearances"),
                *media_items,
            ],
            cls="media",
        )

        return Section(
            [H2("Science Communication"), featured_media_block, nemo_block, media_block],
        )

    def _education_html(self):
        education_cards = []
        for edu in self.config.education:
            card_content = [
                Div(
                    [
                        Div(
                            [
                                P(edu.institution),
                                P(edu.years, cls="years"),
                            ]
                        ),
                        Img(f"logos/{edu.logo}", alt=edu.institution + " logo") if edu.logo else None,
                    ],
                    cls="institution",
                ),
                H3(edu.degree, cls="degree"),
            ]
            if edu.description:
                card_content.append(P(edu.description, cls="description"))

            if edu.thesis:
                card_content.append(P(f"Thesis: {edu.thesis}", cls="thesis"))

            if edu.supervisors:
                supervisors_text = ", ".join(edu.supervisors)
                card_content.append(P(f"Supervisors: {supervisors_text}", cls="supervisors"))

            education_cards.append(
                Div(card_content),
            )

        return Section(
            [
                H2("Education"),
                Div(
                    education_cards,
                ),
                P(
                    "← Swipe left to see earlier education",
                ),
            ],
            cls="education",
        )

    @property
    def layout(self) -> str:
        return Path(self.config.layout.skeleton).read_text()

    @property
    def css_link(self) -> str:
        """Concatenate all CSS files and save to output folder with hash-based filename."""
        output = Path(self.config.layout.output)

        # Find all CSS files in the css folder
        css_files = list(Path(self.config.layout.folder).glob("*.css"))
        if not css_files:
            raise RuntimeWarning(f"Warning: No CSS files found in {self.config.layout.folder} folder")

        # Sort files for consistent ordering
        css_files.sort()

        # Concatenate all CSS content
        concatenated_css = ""
        for css_file in css_files:
            concatenated_css += f"/* {css_file.name} */\n{css_file.read_text(encoding='utf-8')}\n"

        css_hash = hashlib.md5(concatenated_css.encode("utf-8")).hexdigest()[:8]
        css_filename = f"style-{css_hash}.css"

        # Clean up old CSS files in output folder
        for existing_file in output.glob("style-*.css"):
            existing_file.unlink()
            print(f"Deleted existing CSS file: {existing_file}")

        (output / css_filename).write_text(concatenated_css)

        # return f'<link rel="stylesheet" href="{css_filename}">'
        return f"<style>{concatenated_css}</style>"

    def build_site(self) -> None:
        print("Building static site...")

        # Remove global featured media bar
        # Generate science communication HTML
        scicomm_html = self._science_communication_html() or ""
        # Generate education HTML
        education_html = self._education_html() or ""
        # Generate bibliography HTML
        bibliography_html = self.bib_parser.as_html()

        # Insert CSS link into head
        layout_html = self.layout.replace("{{head}}", f"{self.css_link}")

        # Insert all sections into main (science communication first)
        layout_html = layout_html.replace("{{main}}", f"{scicomm_html}{education_html}{bibliography_html}")

        # Ensure output folder exists
        output_folder = Path(self.config.layout.output)
        output_folder.mkdir(exist_ok=True)

        # Write output file as index.html
        output_file = output_folder / "index.html"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(layout_html)

        print(f"Site built successfully: {output_file}")


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
