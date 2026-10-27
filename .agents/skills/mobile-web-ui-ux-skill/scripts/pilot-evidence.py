#!/usr/bin/env python3
"""Offline, allowlisted cross-project UX pilot evidence export/validate/import.

Only transfers generated text artifacts. Does not read project source, upload,
run GitHub commands, or attest evidence truth or confidentiality.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile

MAX_INPUT = 131_072
MAX_FILE = 131_072
MEMBERS = ("manifest.json", "checks.json", "report.md")
HEX40 = re.compile(r"[0-9a-f]{40}\Z")
HEX64 = re.compile(r"[0-9a-f]{64}\Z")
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?\Z")
CHECK_PHASES = {"before", "after", "regression"}
CHECK_TARGETS = {"TASK", "DATA", "BUSINESS", "A11Y", "DESKTOP", "METADATA"}
CHECK_RESULTS = {"PASS", "FAIL", "INFERRED", "NOT RUN"}
CHECK_METHODS = {"browser", "unit", "typecheck", "source-review", "human-review", "unavailable"}
RISK_PATTERN = re.compile(
    r"(?:/home/|/root(?:/|\b)|/Users/|/mnt/[a-z]/Users/|"
    r"[a-z]:[\\/](?:Users|home|Windows)[\\/]|file://|"
    r"\.{2}[\\/]|\\\\|"
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|"
    r"\b(?:gh[pousr]_|github_pat_|sk-[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{16})|"
    r"\b(?:bearer\s+\S+|(?:authorization|password|api[_-]?key|client[_-]?secret)\s*[:=]\s*\S+)|"
    r"\b(?:https?://)(?!github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+\b))",
    re.IGNORECASE,
)


class EvidenceError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise EvidenceError(message)


def exact(obj: object, keys: set[str], where: str, optional: set[str] = frozenset()) -> dict:
    require(type(obj) is dict, f"{where}: expected object")
    require(keys <= obj.keys() and obj.keys() <= keys | optional,
            f"{where}: missing or unexpected fields")
    return obj


def safe_text(value: object, label: str, limit: int = 240) -> str:
    require(type(value) is str and 0 < len(value) <= limit, f"{label}: invalid text length/type")
    require(value == value.strip() and not any(ord(ch) < 32 or ord(ch) == 127 for ch in value),
            f"{label}: control characters or surrounding whitespace")
    require(not RISK_PATTERN.search(value), f"{label}: potentially sensitive text/path/URL")
    require(not re.search(r"https?://|[\\/](?:\.git|\.env)(?:[\\/]|\b)", value, re.I)
            or bool(re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+", value)),
            f"{label}: unapproved URL or path")
    return value


def slug(value: object, label: str) -> str:
    s = safe_text(value, label, 64)
    require(bool(SLUG.fullmatch(s)), f"{label}: expected lowercase slug")
    return s


def sha(value: object, label: str, allow_unknown: bool = False, allow_uncommitted: bool = False) -> str:
    require(type(value) is str and (bool(HEX40.fullmatch(value)) or
            (allow_unknown and value == "unknown") or
            (allow_uncommitted and value == "UNCOMMITTED")),
            f"{label}: invalid 40-hex SHA or explicit unknown state")
    return value


def digest(value: object, label: str) -> str:
    require(type(value) is str and bool(HEX64.fullmatch(value)), f"{label}: invalid SHA-256")
    return value


def check_identity(doc: dict) -> None:
    exact(doc, {"schema_version", "pilot_id", "skill", "project", "agent", "task", "scope",
                "environment", "created_utc", "decision", "limitations"}, "draft")
    require(type(doc["schema_version"]) is int and doc["schema_version"] == 1, "unknown schema version")
    slug(doc["pilot_id"], "pilot_id")
    skill = exact(doc["skill"], {"version", "source_sha", "payload_sha256"}, "skill")
    require(type(skill["version"]) is str and bool(VERSION.fullmatch(skill["version"])), "invalid skill version")
    sha(skill["source_sha"], "skill.source_sha", allow_unknown=True)
    digest(skill["payload_sha256"], "skill.payload_sha256")
    project = exact(doc["project"], {"alias", "baseline_sha", "after_sha", "dirty_state"},
                    "project", {"file_manifest_sha256", "public_pr_url"})
    slug(project["alias"], "project.alias")
    sha(project["baseline_sha"], "project.baseline_sha")
    sha(project["after_sha"], "project.after_sha", allow_uncommitted=True)
    require(project["dirty_state"] in ("clean", "dirty") and type(project["dirty_state"]) is str,
            "invalid dirty_state")
    require((project["after_sha"] == "UNCOMMITTED") == (project["dirty_state"] == "dirty"),
            "UNCOMMITTED must match dirty_state=dirty")
    if project["dirty_state"] == "dirty":
        digest(project.get("file_manifest_sha256"), "project.file_manifest_sha256")
    else:
        require("file_manifest_sha256" not in project, "clean project must not claim dirty file hash")
    if "public_pr_url" in project:
        url = safe_text(project["public_pr_url"], "public_pr_url", 200)
        require(bool(re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+", url)),
                "public PR URL must be a plain GitHub pull URL; still requires human review")
    agent = exact(doc["agent"], {"runtime", "version"}, "agent")
    safe_text(agent["runtime"], "agent.runtime", 100)
    safe_text(agent["version"], "agent.version", 100)
    task = exact(doc["task"], {"id", "summary"}, "task")
    slug(task["id"], "task.id")
    safe_text(task["summary"], "task.summary", 200)
    route = exact(doc["scope"], {"route_id"}, "scope")
    slug(route["route_id"], "scope.route_id")
    env = exact(doc["environment"], {"browser", "viewport"}, "environment")
    safe_text(env["browser"], "environment.browser", 100)
    vp = exact(env["viewport"], {"width", "height"}, "environment.viewport")
    require(all(type(vp[k]) is int and 1 <= vp[k] <= 10000 for k in ("width", "height")),
            "invalid viewport")
    try:
        require(type(doc["created_utc"]) is str and doc["created_utc"].endswith("Z"), "timestamp must be UTC Z")
        parsed = dt.datetime.fromisoformat(doc["created_utc"].replace("Z", "+00:00"))
        require(parsed.tzinfo is not None and parsed.utcoffset() == dt.timedelta(0), "timestamp not UTC")
    except (ValueError, TypeError) as ex:
        raise EvidenceError("invalid created_utc") from ex
    decision = exact(doc["decision"], {"selected", "rejected", "reason", "preserved"}, "decision")
    for k in decision:
        safe_text(decision[k], "decision." + k, 500)
    require(type(doc["limitations"]) is list and len(doc["limitations"]) <= 12,
            "invalid limitations list")
    for val in doc["limitations"]:
        safe_text(val, "limitation", 240)


def validate_checks(doc: object, identity: dict) -> None:
    exact(doc, {"checks"}, "checks")
    rows = doc["checks"]
    require(type(rows) is list and 3 <= len(rows) <= 100, "checks must contain 3..100 rows")
    ids: set[str] = set()
    phases = set()
    targets = set()
    for i, row in enumerate(rows):
        where = f"checks[{i}]"
        exact(row, {"id", "phase", "target", "status", "method", "assertion",
                    "observed", "revision"}, where, {"evidence_ref"})
        sid = slug(row["id"], where + ".id")
        require(sid not in ids, "duplicate check ID")
        ids.add(sid)
        require(row["phase"] in CHECK_PHASES and type(row["phase"]) is str, where + ": invalid phase")
        require(row["target"] in CHECK_TARGETS and type(row["target"]) is str, where + ": invalid target")
        require(row["status"] in CHECK_RESULTS and type(row["status"]) is str, where + ": invalid status")
        require(row["method"] in CHECK_METHODS and type(row["method"]) is str, where + ": invalid method")
        for key in ("assertion", "observed"):
            safe_text(row[key], where + "." + key, 500)
        rev = row["revision"]
        sha(rev, where + ".revision", allow_uncommitted=True)
        expected = identity["project"]["baseline_sha"] if row["phase"] == "before" else identity["project"]["after_sha"]
        require(rev == expected, where + ": revision does not match phase project SHA")
        status, method = row["status"], row["method"]
        evidence = row.get("evidence_ref")
        if status in ("PASS", "FAIL"):
            require(method in ("browser", "unit", "typecheck", "human-review"),
                    where + ": source review or unavailable cannot prove execution")
            require(type(evidence) is str and bool(re.fullmatch(r"artifact:[a-z0-9]+(?:-[a-z0-9]+)*", evidence)),
                    where + ": executed result requires sanitized artifact ID")
        else:
            require(method in ("source-review", "unavailable"),
                    where + ": INFERRED/NOT RUN must use source-review/unavailable")
            require((status == "INFERRED") == (method == "source-review"),
                    where + ": method conflicts with status")
            require(evidence is None, where + ": unexecuted check cannot cite executed artifact")
        phases.add(row["phase"])
        targets.add(row["target"])
    require({"before", "after", "regression"} <= phases, "missing before/after/regression coverage")
    require("DESKTOP" in targets, "missing desktop regression status")


def json_bytes(doc: object) -> bytes:
    return (json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def read_file(path: Path, cap: int) -> bytes:
    require(not path.is_symlink() and path.is_file(), f"unsafe or missing file: {path.name}")
    require(path.stat().st_size <= cap, f"file too large: {path.name}")
    with path.open("rb") as f:
        data = f.read(cap + 1)
    require(len(data) <= cap, "file exceeds size limit")
    return data


def parse_json(data: bytes, label: str) -> dict:
    try:
        def distinct(pairs):
            result = {}
            for key, val in pairs:
                if key in result:
                    raise EvidenceError(label + ": duplicate JSON property")
                result[key] = val
            return result
        return json.loads(data.decode("utf-8"), object_pairs_hook=distinct)
    except (UnicodeError, ValueError) as ex:
        raise EvidenceError(f"{label}: invalid UTF-8 JSON: {ex}") from ex


def make_report(identity: dict, rows: list[dict]) -> str:
    dec = identity["decision"]
    proj = identity["project"]
    lines = ["# External pilot UX report", "", f"Pilot: {identity['pilot_id']}",
             f"Project alias: {proj['alias']}", f"Task: {identity['task']['summary']}",
             f"Route label: {identity['scope']['route_id']}",
             f"Skill version: {identity['skill']['version']}",
             f"Baseline: {proj['baseline_sha']}", f"After: {proj['after_sha']}",
             "", "## UX choice", f"Selected: {dec['selected']}",
             f"Rejected: {dec['rejected']}", f"Reason: {dec['reason']}",
             f"Preserved: {dec['preserved']}", "", "## Observed checks (not human approval)"]
    for row in rows:
        lines.append(f"- {row['id']} [{row['phase']}/{row['target']}]: {row['status']} via {row['method']} — {row['assertion']}; observed: {row['observed']}")
    lines += ["", "## Limitations and next steps"]
    lines += ["- " + item for item in identity["limitations"]] or ["- No additional limitation recorded; this does not imply full WCAG or device coverage."]
    lines += ["", "This report is scoped pilot evidence, not an independent visual approval or a Tier B skill-superiority result.", ""]
    return "\n".join(lines)


def validate_payload(identity: dict, rows: object, report: str) -> None:
    check_identity(identity)
    validate_checks(rows, identity)
    require(report == make_report(identity, rows["checks"]), "report.md does not match canonical allowlisted record")
    # Check the exact generated text too, not only the source fields.
    for line in report.splitlines():
        if line.startswith(("- ", "Task: ", "Reason: ", "Selected: ", "Rejected: ", "Preserved: ")):
            safe_text(line, "rendered report line", 1400)


def validate_dir(package: Path, policy: str) -> tuple[dict, str]:
    require(not package.is_symlink() and package.is_dir(), "package must be a regular directory")
    require({p.name for p in package.iterdir()} == set(MEMBERS), "package contains missing or extra files")
    blobs = {name: read_file(package / name, MAX_FILE) for name in MEMBERS}
    manifest = parse_json(blobs["manifest.json"], "manifest")
    exact(manifest, {"schema_version", "pilot_id", "skill", "project", "agent", "task", "scope",
                     "environment", "created_utc", "decision", "limitations", "checks_sha256", "report_sha256",
                     "classification"}, "manifest")
    digest(manifest["checks_sha256"], "checks_sha256")
    digest(manifest["report_sha256"], "report_sha256")
    require(manifest["classification"] == "sanitized-review-required", "classification must require review")
    require(hashlib.sha256(blobs["checks.json"]).hexdigest() == manifest["checks_sha256"], "checks hash mismatch")
    require(hashlib.sha256(blobs["report.md"]).hexdigest() == manifest["report_sha256"], "report hash mismatch")
    identity = {key: val for key, val in manifest.items() if key not in ("checks_sha256", "report_sha256", "classification")}
    rows = parse_json(blobs["checks.json"], "checks")
    try:
        report = blobs["report.md"].decode("utf-8")
    except UnicodeError as ex:
        raise EvidenceError("report is not valid UTF-8") from ex
    validate_payload(identity, rows, report)
    require(blobs["manifest.json"] == json_bytes(manifest), "manifest is not canonical JSON")
    require(blobs["checks.json"] == json_bytes(rows), "checks not canonical JSON")
    if policy == "public":
        # A regex-based scan is a detection layer, NOT an assurance of privacy.
        require(not RISK_PATTERN.search(report), "report contains possible sensitive material")
    fp = hashlib.sha256()
    for name in MEMBERS:
        fp.update(name.encode() + b"\0" + blobs[name] + b"\0")
    return manifest, fp.hexdigest()


def safe_destination(path: Path) -> None:
    require(".git" not in path.parts, "refuse to write inside .git")
    current = path.absolute()
    for part in (current, *current.parents):
        require(not part.is_symlink(), "symlink path component is not permitted")


def export_cmd(args) -> None:
    draft_path = Path(args.input)
    safe_destination(draft_path)
    draft = parse_json(read_file(draft_path, MAX_INPUT), "draft")
    exact(draft, {"schema_version", "pilot_id", "skill", "project", "agent", "task", "scope",
                  "environment", "created_utc", "decision", "limitations", "checks"}, "draft")
    rows = {"checks": draft.pop("checks")}
    check_identity(draft)
    validate_checks(rows, draft)
    report = make_report(draft, rows["checks"])
    validate_payload(draft, rows, report)
    checks_bytes = json_bytes(rows)
    report_bytes = report.encode("utf-8")
    manifest = {**draft, "classification": "sanitized-review-required",
                "checks_sha256": hashlib.sha256(checks_bytes).hexdigest(),
                "report_sha256": hashlib.sha256(report_bytes).hexdigest()}
    out = Path(args.out)
    safe_destination(out)
    require(out.name == draft["pilot_id"], "output directory must equal pilot_id")
    require(out.parent.exists() and out.parent.is_dir() and not out.exists(), "output must not exist; parent must exist")
    stage = Path(tempfile.mkdtemp(prefix=".pilot-stage-", dir=out.parent))
    try:
        for name, data in (("manifest.json", json_bytes(manifest)), ("checks.json", checks_bytes),
                           ("report.md", report_bytes)):
            require(len(data) <= MAX_FILE, f"{name} too large")
            (stage / name).write_bytes(data)
        _, fp = validate_dir(stage, "public")
        require(not out.exists(), "output appeared during export")
        stage.rename(out)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    print(f"EXPORTED {out.name} digest={fp} (local; human sharing review still required)")


def validate_cmd(args) -> None:
    safe_destination(Path(args.package))
    manifest, fp = validate_dir(Path(args.package), args.policy)
    print(f"VALID {manifest['pilot_id']} policy={args.policy} digest={fp} (privacy not guaranteed; no UX approval)")


def import_cmd(args) -> None:
    require(args.approve_public, "import requires explicit --approve-public")
    digest(args.approved_digest, "approved_digest")
    package, destination = Path(args.package), Path(args.destination)
    safe_destination(package)
    safe_destination(destination)
    manifest, fp = validate_dir(package, "public")
    require(fp == args.approved_digest, "package bytes differ from human-approved digest")
    require(destination.is_dir(), "destination parent must already exist")
    final = destination / manifest["pilot_id"]
    safe_destination(final)
    require(not final.exists() and not final.is_symlink(), "pilot already imported; never overwrite")
    stage = Path(tempfile.mkdtemp(prefix=".pilot-import-", dir=destination))
    try:
        for name in MEMBERS:
            (stage / name).write_bytes(read_file(package / name, MAX_FILE))
        review = ("# Imported pilot review\n\nStatus: PENDING\n\n"
                  "Reviewer: NOT ASSIGNED\nClassification: UNDETERMINED\n"
                  "Disposition: INSUFFICIENT_EVIDENCE\n\n"
                  "Source references: NOT REVIEWED\nEvidence and checks: NOT REVIEWED\n"
                  "Reproduction and counterexample: NOT RUN\nFollow-up: Review before using in skill decisions.\n")
        (stage / "review.md").write_text(review, encoding="utf-8")
        require(not final.exists(), "pilot already imported during staging")
        stage.rename(final)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    print(f"IMPORTED {manifest['pilot_id']} digest={fp} review=PENDING (no GitHub action)")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    exp = sub.add_parser("export", help="create three-file local package from explicit sanitized draft")
    exp.add_argument("--input", required=True)
    exp.add_argument("--out", required=True)
    val = sub.add_parser("validate", help="check schema, integrity and best-effort privacy policy")
    val.add_argument("--package", required=True)
    val.add_argument("--policy", choices=("private", "public"), default="private")
    imp = sub.add_parser("import", help="copy approved local package into skill repo, pending review")
    imp.add_argument("--package", required=True)
    imp.add_argument("--destination", required=True)
    imp.add_argument("--approve-public", action="store_true")
    imp.add_argument("--approved-digest", required=True, help="exact digest shown at human public review")
    args = parser.parse_args(argv)
    try:
        {"export": export_cmd, "validate": validate_cmd, "import": import_cmd}[args.command](args)
        return 0
    except (EvidenceError, OSError, UnicodeError) as ex:
        print(f"ERROR: {ex}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
