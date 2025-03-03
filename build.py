import hashlib
import importlib.util
import itertools
import os
from pathlib import Path

isDEV = "--dev" in os.sys.argv
NAME = "Sarai Keestra"
DOCS_DIR = (Path(__file__).parent / "docs").absolute()
URL_ROOT = "/docs" if isDEV else "http://saraikeestra.com"


def update_css() -> str:
    css_files = sorted(DOCS_DIR.glob("*.css"))
    css = "\n".join(f.read_text() for f in css_files)
    hash = hashlib.sha256(css.encode("utf-8")).hexdigest()[:10]
    [f.unlink() for f in css_files]
    (DOCS_DIR / f"{hash}.css").write_text(css)
    return hash


def exec_content_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.parent.name.replace("-", "_"), path)
    if spec is None:
        print(f"Couldn't spec_from_file_location for {path}")
        return ""
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "generate"):
        print(f"No generate() function in {path}")
        return ""
    return module.generate()


CSSHASH = update_css()
LAYOUT = (DOCS_DIR / "__layout.html").read_text().replace("{{ROOT}}", URL_ROOT + "/").replace("{{CSSHASH}}", CSSHASH)

for content_file in itertools.chain(DOCS_DIR.rglob("content.html"), DOCS_DIR.rglob("content.py")):
    os.chdir(content_file.parent)

    header_file = content_file.with_name("head.html")
    index_file = content_file.with_name("index.html")

    slug = content_file.parent.name
    pagetitle = f"{slug.replace('_', ' ').title()} - {NAME}"
    content = exec_content_module(content_file) if content_file.suffix == ".py" else content_file.read_text()
    head = header_file.read_text() if header_file.exists() else ""

    output = LAYOUT
    output = output.replace("{{PAGETITLE}}", pagetitle)
    output = output.replace("{{CONTENT}}", content)
    output = output.replace("{{HEAD}}", head)
    output = output.replace(f'href="/{slug}"', f'href="/{slug}" class="active" ')
    index_file.write_text(output)
    print(f"Built {content_file.parent.name}")
