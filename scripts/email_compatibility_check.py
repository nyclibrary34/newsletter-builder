"""Heuristic checker for exported newsletter HTML."""

from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from bs4 import BeautifulSoup, Comment


UNSUPPORTED_DISPLAY = re.compile(r"display\s*:\s*(flex|grid|inline-flex)", re.I)
UNSUPPORTED_POSITION = re.compile(r"position\s*:\s*(absolute|fixed)", re.I)
FLOAT_USAGE = re.compile(r"float\s*:\s*(left|right)", re.I)
OVERFLOW_USAGE = re.compile(r"overflow(-[xy])?\s*:\s*(auto|scroll|hidden)", re.I)
SHORTHAND_SPACING = re.compile(r"(margin|padding)\s*:\s*[^;]*\s[^;]*", re.I)


@dataclass
class Finding:
    rule_id: str
    severity: str
    message: str
    detail: Dict[str, float]

    def penalty(self) -> float:
        weights = {"high": 3.0, "medium": 1.5, "low": 0.5}
        return weights.get(self.severity, 1.0)


def load_html(path: Path) -> BeautifulSoup:
    html = path.read_text(encoding="utf-8", errors="ignore")
    return BeautifulSoup(html, "html.parser")


def significant_children(body) -> List:
    return [
        child
        for child in body.children
        if not isinstance(child, Comment)
        and (
            getattr(child, "name", None)
            or (str(child).strip() and not str(child).isspace())
        )
    ]


def gather_inline_styles(elements: Iterable) -> List[str]:
    return [el.get("style", "") for el in elements if isinstance(el.get("style", ""), str)]


def check_layout(body) -> List[Finding]:
    findings: List[Finding] = []
    candidates = significant_children(body)
    primary = candidates[0] if candidates else None
    if primary and getattr(primary, "name", "").lower() == "center":
        candidates = significant_children(primary)
    outer = next(
        (child for child in candidates if getattr(child, "name", "").lower() == "table"),
        None,
    )
    if not outer:
        findings.append(
            Finding(
                rule_id="layout.outer_table",
                severity="high",
                message="Body does not start with a full-width table wrapper.",
                detail={},
            )
        )
        return findings
    top_style = (outer.get("style") or "").lower()
    if not outer.get("width") and "width" not in top_style:
        findings.append(
            Finding(
                rule_id="layout.outer_table_width",
                severity="medium",
                message="Top-level table is missing explicit width; add width attribute or inline style.",
                detail={},
            )
        )
    tables = body.find_all("table")
    if not tables:
        findings.append(
            Finding(
                rule_id="layout.no_tables",
                severity="high",
                message="No table elements found; Outlook requires table-based layout.",
                detail={},
            )
        )
        return findings
    return findings


def check_css_usage(styles: Iterable[str]) -> List[Finding]:
    findings: List[Finding] = []
    styles_joined = "\n".join(styles)
    if UNSUPPORTED_DISPLAY.search(styles_joined):
        findings.append(
            Finding(
                rule_id="css.flex_grid",
                severity="high",
                message="Detected flexbox or grid display declarations.",
                detail={},
            )
        )
    if UNSUPPORTED_POSITION.search(styles_joined):
        findings.append(
            Finding(
                rule_id="css.absolute_position",
                severity="medium",
                message="Detected absolute or fixed positioning.",
                detail={},
            )
        )
    if FLOAT_USAGE.search(styles_joined):
        findings.append(
            Finding(
                rule_id="css.float",
                severity="medium",
                message="Detected float usage; Outlook Word often misinterprets floats.",
                detail={},
            )
        )
    if OVERFLOW_USAGE.search(styles_joined):
        findings.append(
            Finding(
                rule_id="css.overflow",
                severity="medium",
                message="Detected overflow values that Outlook ignores.",
                detail={},
            )
        )
    if SHORTHAND_SPACING.search(styles_joined):
        findings.append(
            Finding(
                rule_id="css.shorthand_spacing",
                severity="low",
                message="Detected shorthand margin/padding declarations.",
                detail={},
            )
        )
    return findings


def check_images(soup: BeautifulSoup) -> List[Finding]:
    findings: List[Finding] = []
    images = soup.find_all("img")
    missing = [
        img
        for img in images
        if img.get("role") != "presentation"
        and not (
            img.get("width")
            or ("width" in (img.get("style") or "").lower())
        )
    ]
    if missing:
        findings.append(
            Finding(
                rule_id="media.image_dimensions",
                severity="medium",
                message="Images missing width/height attributes may shift in Gmail.",
                detail={"missing_count": float(len(missing)), "total_images": float(len(images))},
            )
        )
    return findings


def check_typography(soup: BeautifulSoup) -> List[Finding]:
    findings: List[Finding] = []
    td_nodes = [
        td
        for td in soup.find_all("td")
        if td.get_text(strip=True) or td.find("img")
    ]
    styled = sum(1 for td in td_nodes if td.get("style"))
    if td_nodes:
        ratio = styled / len(td_nodes)
        if ratio < 0.6:
            findings.append(
                Finding(
                    rule_id="typography.inline_styles",
                    severity="medium",
                    message="Less than 60% of populated table cells include inline styles.",
                    detail={"td_count": len(td_nodes), "styled": styled, "ratio": ratio},
                )
            )
    body = soup.body
    body_styles = (body.get("style") or "").lower() if body else ""
    fallback_table = None
    if not body_styles and body:
        inner_children = significant_children(body)
        if inner_children:
            candidate = inner_children[0]
            if getattr(candidate, "name", "").lower() == "center":
                candidate_children = significant_children(candidate)
                candidate = candidate_children[0] if candidate_children else None
            fallback_table = candidate if getattr(candidate, "name", "").lower() == "table" else None
    font_declared = False
    if body_styles and "font-family" in body_styles:
        font_declared = True
    elif fallback_table and "font-family" in (fallback_table.get("style") or "").lower():
        font_declared = True
    if not font_declared:
        findings.append(
            Finding(
                rule_id="typography.body_font",
                severity="low",
                message="Body tag lacks inline font-family declaration.",
                detail={},
            )
        )
    return findings


def evaluate(path: Path) -> Tuple[float, List[Finding]]:
    soup = load_html(path)
    if not soup.body:
        missing_body = Finding(
            rule_id="structure.no_body",
            severity="high",
            message="HTML document missing <body>; cannot evaluate layout.",
            detail={},
        )
        return 1.0, [missing_body]
    inline_styles = gather_inline_styles(soup.find_all(True))
    findings: List[Finding] = []
    findings.extend(check_layout(soup.body))
    findings.extend(check_css_usage(inline_styles))
    findings.extend(check_images(soup))
    findings.extend(check_typography(soup))

    penalty = sum(f.penalty() for f in findings)
    score = 10.0 - penalty
    if findings:
        score = max(1.0, score)
    else:
        score = 10.0
    return round(score, 1), findings


def write_reports(base: Path, score: float, findings: List[Finding], target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    summary = {
        "input": str(base),
        "score": score,
        "findings": [asdict(f) for f in findings],
    }
    json_path = target.with_suffix(".json")
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    md_lines = [
        "# Email Compatibility Report",
        f"- File: `{base}`",
        f"- Score: {score}/10",
        "",
    ]
    if findings:
        md_lines.append("## Findings")
        for f in findings:
            detail_pairs = ", ".join(f"{k}={v:.2f}" if isinstance(v, float) else f"{k}={v}" for k, v in f.detail.items())
            md_lines.append(f"- **{f.rule_id}** ({f.severity}): {f.message}"
                            + (f" ({detail_pairs})" if detail_pairs else ""))
    else:
        md_lines.append("No issues detected.")
    md_path = target.with_suffix(".md")
    md_path.write_text("\n".join(md_lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate exported HTML for email compatibility risks.")
    parser.add_argument("--input", required=True, type=Path, help="Path to exported HTML file.")
    parser.add_argument(
        "--report",
        type=Path,
        help="Base path for report output (writes .json and .md). Omit extension.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise SystemExit(f"Input file not found: {args.input}")
    score, findings = evaluate(args.input)
    print(json.dumps({"score": score, "finding_count": len(findings)}, indent=2))
    if args.report:
        write_reports(args.input, score, findings, args.report)


if __name__ == "__main__":
    main()
