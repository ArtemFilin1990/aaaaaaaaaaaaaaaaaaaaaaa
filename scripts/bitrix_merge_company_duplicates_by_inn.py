#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request

INN_FIELD = "UF_CRM_4_IF_INN"
NOT_CALL_UID = "25"
NOT_CALL_NAME = "НЕ ЗВОНИТЬ"

ACTIVE_MANAGERS = {
    "1": "Филинцев Артем",
    "13": "Максим Титов",
    "31": "Алексей Филинцев",
    "47": "Марина Крутилова",
    "1057": "Владлена Попова",
    "1059": "Дарья Иванова",
    "1211": "Надежда Третьякова",
    "1219": "Аванес Алексанян",
}
FUNNEL_USERS = {
    "911": "СВОБОДНЫЕ КОМПАНИИ",
    "15": "НЕ ЗАКУПАЮТ",
    "21": "ТЕНДЕРЫ",
    "19": "НЕДОЗВОНЫ",
    "75": "ПЕРЕКУПЫ",
    "23": "НОВЫЕ КОМПАНИИ",
}
INACTIVE_USERS = {
    "17": "Елена Коробова",
    "27": "Зинаида Филинцева",
    "29": "Екатерина Чистякова",
    "35": "Оксана Скворцова",
    "37": "Ярослав Яблоков",
    "41": "Михаил",
    "73": "Елена Антуфьева",
    "173": "Юрий Маклаков",
    "359": "Татьяна Селюдченкова",
    "385": "Андрей Балакин",
    "537": "Анастасия Жебуртович",
    "629": "Pavel Zhukov",
}
OWNER_PRIORITY = {
    "ACTIVE_MANAGER": 1,
    "FUNNEL_USER": 2,
    "UNKNOWN_USER": 3,
    "INACTIVE_USER": 4,
    "NOT_CALL": 5,
}


class BitrixError(RuntimeError):
    pass


class BitrixClient:
    def __init__(self, webhook_url: str, request_delay: float = 0.3, max_retries: int = 4) -> None:
        self.base = webhook_url.rstrip("/") + "/"
        self.delay = request_delay
        self.max_retries = max_retries

    def _endpoint(self, method: str) -> str:
        safe_method = method.strip().strip("/")
        if not re.fullmatch(r"[a-zA-Z0-9_.]+", safe_method):
            raise BitrixError(f"Unsafe method name: {method}")
        return parse.urljoin(self.base, f"{safe_method}.json")

    def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        payload = json.dumps(params, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                req = request.Request(self._endpoint(method), data=payload, headers=headers, method="POST")
                with request.urlopen(req, timeout=30) as resp:
                    raw = json.loads(resp.read().decode())
                if "error" in raw:
                    msg = raw.get("error_description") or raw["error"]
                    if raw["error"] in {"QUERY_LIMIT_EXCEEDED", "TOO_MANY_REQUESTS"} and attempt < self.max_retries:
                        time.sleep(self.delay * (attempt + 2))
                        continue
                    raise BitrixError(f"Bitrix error for {method}: {msg}")
                time.sleep(self.delay)
                return raw.get("result")
            except (error.HTTPError, error.URLError, TimeoutError) as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break
                time.sleep(self.delay * (attempt + 2))
        raise BitrixError(f"Request failed for {method}: {type(last_error).__name__}")

    def paginated_list(self, method: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        start = 0
        while True:
            page = dict(params)
            page["start"] = start
            result = self.call(method, page)
            if not isinstance(result, list):
                break
            out.extend(result)
            if len(result) < int(params.get("limit", 50)):
                break
            start += len(result)
        return out


def normalize_inn(value: Any) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits if len(digits) in (10, 12) else None


def normalize_ogrn(value: Any) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits if len(digits) in (13, 15) else None


def parse_dt(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def classify_owner(assigned_by_id: Any) -> str:
    uid = str(assigned_by_id or "")
    if uid in ACTIVE_MANAGERS:
        return "ACTIVE_MANAGER"
    if uid in FUNNEL_USERS:
        return "FUNNEL_USER"
    if uid == NOT_CALL_UID:
        return "NOT_CALL"
    if uid in INACTIVE_USERS:
        return "INACTIVE_USER"
    return "UNKNOWN_USER"


def load_all_companies(client: BitrixClient, page_size: int) -> list[dict[str, Any]]:
    return client.paginated_list(
        "crm.company.list",
        {"select": ["*", "UF_*"], "order": {"ID": "ASC"}, "limit": page_size},
    )


def load_company_requisites(
    client: BitrixClient,
    company_ids: list[str],
    page_size: int,
) -> dict[str, list[dict[str, Any]]]:
    reqs: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cid in company_ids:
        rows = client.paginated_list(
            "crm.requisite.list",
            {
                "filter": {"ENTITY_TYPE_ID": 4, "ENTITY_ID": cid},
                "select": ["*"],
                "limit": page_size,
            },
        )
        reqs[cid].extend(rows)
    return reqs


def load_group_activities(client: BitrixClient, company_ids: list[str], page_size: int) -> dict[str, datetime | None]:
    last_activity: dict[str, datetime | None] = {}
    for cid in company_ids:
        rows = client.paginated_list(
            "crm.activity.list",
            {
                "filter": {"OWNER_TYPE_ID": 4, "OWNER_ID": cid},
                "order": {"LAST_UPDATED": "DESC"},
                "select": ["LAST_UPDATED", "CREATED"],
                "limit": 1,
            },
        )
        last_activity[cid] = parse_dt(rows[0].get("LAST_UPDATED") or rows[0].get("CREATED")) if rows else None
    return last_activity


def detect_company_identifiers(company: dict[str, Any], requisites: list[dict[str, Any]]) -> dict[str, Any]:
    inn_values = [normalize_inn(company.get(INN_FIELD))]
    ogrns: set[str] = set()
    for req in requisites:
        inn_values.append(normalize_inn(req.get("RQ_INN")))
        ogrn = normalize_ogrn(req.get("RQ_OGRN"))
        ogrnip = normalize_ogrn(req.get("RQ_OGRNIP"))
        if ogrn:
            ogrns.add(ogrn)
        if ogrnip:
            ogrns.add(ogrnip)
    inn_values = [x for x in inn_values if x]
    return {"inn": inn_values[0] if inn_values else None, "inn_sources": inn_values, "ogrns": sorted(ogrns)}


def group_duplicates_by_inn(companies_with_identifiers: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in companies_with_identifiers:
        if item["identifiers"]["inn"]:
            grouped[item["identifiers"]["inn"]].append(item)
    return {k: v for k, v in grouped.items() if len(v) > 1}


def detect_ogrn_conflict(group: list[dict[str, Any]]) -> bool:
    values = {ogrn for row in group for ogrn in row["identifiers"]["ogrns"]}
    return len(values) > 1


def select_winner(group: list[dict[str, Any]]) -> dict[str, Any]:
    def sort_key(row: dict[str, Any]) -> tuple:
        return (
            OWNER_PRIORITY[row["owner_group"]],
            -(row.get("last_activity") or datetime.fromtimestamp(0, timezone.utc)).timestamp(),
            -(parse_dt(row["company"].get("DATE_MODIFY")) or datetime.fromtimestamp(0, timezone.utc)).timestamp(),
            -(parse_dt(row["company"].get("DATE_CREATE")) or datetime.fromtimestamp(0, timezone.utc)).timestamp(),
            -int(row["company"]["ID"]),
        )

    active = [r for r in group if r["owner_group"] == "ACTIVE_MANAGER"]
    if active:
        return sorted(active, key=sort_key)[0]
    return sorted(group, key=sort_key)[0]


def merge_fields_into_winner(
    winner: dict[str, Any],
    loser: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    updates: dict[str, Any] = {}
    conflicts: list[dict[str, Any]] = []
    transferable_fields = {
        "ADDRESS",
        "ADDRESS_CITY",
        "ADDRESS_REGION",
        "ADDRESS_COUNTRY",
        "ADDRESS_POSTAL_CODE",
    }
    for k, v in loser.items():
        if not (k.startswith("UF_") or k in transferable_fields):
            continue
        if v in (None, "", []):
            continue
        wv = winner.get(k)
        if wv in (None, "", []):
            updates[k] = v
        elif wv != v:
            conflicts.append({"field": k, "winner_value": wv, "loser_value": v})
    return updates, conflicts


def merge_communications(
    winner: dict[str, Any],
    loser: dict[str, Any],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    merged, adds = {}, {}
    for key in ("PHONE", "EMAIL", "WEB"):
        w = winner.get(key) or []
        l = loser.get(key) or []
        winner_values = {str(x.get("VALUE", "")).strip().lower() for x in w}
        uniq, seen = [], set()
        for entry in [*w, *l]:
            val = str(entry.get("VALUE", "")).strip().lower()
            if not val or val in seen:
                continue
            seen.add(val)
            uniq.append(entry)
        if uniq != w:
            merged[key] = uniq
            adds[key] = [entry for entry in uniq if str(entry.get("VALUE", "")).strip().lower() not in winner_values]
    return merged, adds


def get_company_deal_ids(client: BitrixClient, company_id: str) -> list[str]:
    deals = client.paginated_list(
        "crm.deal.list",
        {"filter": {"COMPANY_ID": company_id}, "select": ["ID"], "limit": 50},
    )
    return [str(deal["ID"]) for deal in deals]


def get_company_contact_ids(client: BitrixClient, company_id: str) -> list[str]:
    contacts = client.call("crm.company.contact.items.get", {"id": company_id}) or []
    ids: list[str] = []
    for contact in contacts:
        cid = contact.get("CONTACT_ID") or contact.get("contactId") or contact.get("ID")
        if cid:
            ids.append(str(cid))
    return ids


def get_company_requisites(client: BitrixClient, company_id: str, page_size: int) -> list[dict[str, Any]]:
    return client.paginated_list(
        "crm.requisite.list",
        {"filter": {"ENTITY_TYPE_ID": 4, "ENTITY_ID": company_id}, "select": ["*"], "limit": page_size},
    )


def requisite_key(req: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        str(req.get("PRESET_ID") or ""),
        str(req.get("RQ_INN") or ""),
        str(req.get("RQ_KPP") or ""),
        str(req.get("RQ_OGRN") or req.get("RQ_OGRNIP") or ""),
    )


def append_error(errors_path: Path, message: str) -> None:
    with errors_path.open("a", encoding="utf-8") as fh:
        fh.write(f"{datetime.now(timezone.utc).isoformat()} {message}\n")


def build_merge_plan(
    groups: dict[str, list[dict[str, Any]]],
    allow_unknown: bool,
    allow_ogrn_conflict: bool,
    allow_active_to_active: bool,
    client: BitrixClient,
    page_size: int = 50,
) -> dict[str, Any]:
    plan_groups = []
    methods = set(client.call("methods") or [])
    has_contact_add = "crm.company.contact.add" in methods
    has_requisite_update = "crm.requisite.update" in methods
    for inn, group in groups.items():
        winner = select_winner(group)
        losers = [x for x in group if x["company"]["ID"] != winner["company"]["ID"]]
        ogrn_conflict = detect_ogrn_conflict(group)
        warnings = []
        allowed = True

        active_manager_count = sum(1 for x in group if x["owner_group"] == "ACTIVE_MANAGER")
        if active_manager_count > 1 and not allow_active_to_active:
            warnings.append("MANUAL_REVIEW_REQUIRED: multiple active managers")
            allowed = False
        if ogrn_conflict and not allow_ogrn_conflict:
            warnings.append("MANUAL_REVIEW_REQUIRED: OGRN/OGRNIP conflict")
            allowed = False
        if any(x["owner_group"] == "UNKNOWN_USER" for x in group) and winner["owner_group"] != "ACTIVE_MANAGER" and not allow_unknown:
            warnings.append("MANUAL_REVIEW_REQUIRED: unknown user in non-active-manager group")
            allowed = False

        field_transfers, communication_transfers, field_conflicts = {}, {}, []
        deals_to_move, contacts_to_bind, requisites_to_move = {}, {}, {}
        requisites_conflicts, bank_details_status = {}, {}
        activities_status = {"loaded_for_group": True, "notes": "Activity audit is informational only; no writes."}

        winner_requisites = get_company_requisites(client, str(winner["company"]["ID"]), page_size)
        winner_req_keys = {requisite_key(r) for r in winner_requisites}
        for loser in losers:
            loser_id = str(loser["company"]["ID"])
            updates, conflicts = merge_fields_into_winner(winner["company"], loser["company"])
            comm_update, comm_added = merge_communications(winner["company"], loser["company"])
            field_transfers[loser_id] = updates
            communication_transfers[loser_id] = comm_added
            field_conflicts.extend(conflicts)

            deals_to_move[loser_id] = get_company_deal_ids(client, loser_id)

            winner_contact_ids = set(get_company_contact_ids(client, str(winner["company"]["ID"])))
            loser_contact_ids = set(get_company_contact_ids(client, loser_id))
            contacts_to_bind[loser_id] = sorted(loser_contact_ids - winner_contact_ids)

            loser_requisites = get_company_requisites(client, loser_id, page_size)
            movable, conflicts_req = [], []
            for req in loser_requisites:
                key = requisite_key(req)
                if key in winner_req_keys:
                    conflicts_req.append({"requisite_id": str(req.get("ID")), "key": key})
                    continue
                movable.append(str(req.get("ID")))
            requisites_to_move[loser_id] = movable
            requisites_conflicts[loser_id] = conflicts_req
            bank_details_status[loser_id] = "unknown: bank detail migration not implemented, requires manual check"

            if comm_update:
                winner["company"].update(comm_update)
            if updates:
                winner["company"].update(updates)

        if not has_contact_add:
            warnings.append("MANUAL_REVIEW_REQUIRED: crm.company.contact.add unavailable")
            allowed = False
        if not has_requisite_update:
            warnings.append("MANUAL_REVIEW_REQUIRED: crm.requisite.update unavailable")
            allowed = False

        plan_groups.append(
            {
                "inn": inn,
                "winner_id": str(winner["company"]["ID"]),
                "winner_owner_group": winner["owner_group"],
                "loser_ids": [str(x["company"]["ID"]) for x in losers],
                "active_manager_count": active_manager_count,
                "ogrn_conflict": ogrn_conflict,
                "fields_to_fill": field_transfers,
                "communication_merge": communication_transfers,
                "deals_to_move": deals_to_move,
                "contacts_to_bind": contacts_to_bind,
                "requisites_to_move": requisites_to_move,
                "requisite_conflicts": requisites_conflicts,
                "bank_details_status": bank_details_status,
                "activities_notes_status": activities_status,
                "field_conflicts": field_conflicts,
                "warnings": warnings,
                "allowed_for_apply": allowed,
            }
        )
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "groups": plan_groups, "page_size": page_size}


def ensure_fresh_plan(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise BitrixError("merge_plan.json not found")
    data = json.loads(path.read_text(encoding="utf-8"))
    ts = parse_dt(data.get("generated_at"))
    if not ts or datetime.now(timezone.utc) - ts > timedelta(hours=24):
        raise BitrixError("merge_plan.json is older than 24h")
    return data


def apply_merge_plan(client: BitrixClient, plan: dict[str, Any], page_size: int, errors_path: Path) -> None:
    processed = 0
    methods = set(client.call("methods") or [])
    if "crm.company.contact.add" not in methods or "crm.requisite.update" not in methods:
        raise BitrixError("Required methods unavailable: crm.company.contact.add and/or crm.requisite.update")

    for group in plan["groups"]:
        if not group["allowed_for_apply"]:
            continue
        try:
            winner_id = str(group["winner_id"])
            winner = client.call("crm.company.get", {"id": winner_id})
            for loser_id in group["loser_ids"]:
                loser_id = str(loser_id)
                loser = client.call("crm.company.get", {"id": loser_id})
                fields, _ = merge_fields_into_winner(winner, loser)
                comm, _ = merge_communications(winner, loser)
                update_fields = {**fields, **comm}
                if update_fields:
                    client.call("crm.company.update", {"id": winner_id, "fields": update_fields})
                    winner.update(update_fields)

                for deal_id in get_company_deal_ids(client, loser_id):
                    client.call("crm.deal.update", {"id": deal_id, "fields": {"COMPANY_ID": winner_id}})

                winner_contact_ids = set(get_company_contact_ids(client, winner_id))
                loser_contact_ids = set(get_company_contact_ids(client, loser_id))
                for cid in sorted(loser_contact_ids - winner_contact_ids):
                    client.call("crm.company.contact.add", {"id": winner_id, "fields": {"CONTACT_ID": cid}})

                winner_requisites = get_company_requisites(client, winner_id, page_size)
                winner_req_keys = {requisite_key(r) for r in winner_requisites}
                loser_requisites = get_company_requisites(client, loser_id, page_size)
                for req in loser_requisites:
                    if requisite_key(req) in winner_req_keys:
                        append_error(errors_path, f"requisite_conflict winner={winner_id} loser={loser_id} requisite_id={req.get('ID')}")
                        continue
                    client.call("crm.requisite.update", {"id": req["ID"], "fields": {"ENTITY_ID": winner_id}})
            processed += 1
        except Exception as exc:
            append_error(errors_path, f"group_apply_failed inn={group.get('inn')} winner={group.get('winner_id')} error={exc}")
            continue

    errors_path.touch(exist_ok=True)
    print(f"Apply finished. processed_groups={processed}")


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--audit", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--allow-unknown-user-merge", action="store_true")
    parser.add_argument("--allow-ogrn-conflict-merge", action="store_true")
    parser.add_argument("--allow-active-to-active-merge", action="store_true")
    args = parser.parse_args()

    webhook = os.getenv("BITRIX_WEBHOOK_URL", "").strip()
    if not webhook:
        raise BitrixError("BITRIX_WEBHOOK_URL is required")
    request_delay = float(os.getenv("REQUEST_DELAY", "0.3"))
    page_size = int(os.getenv("PAGE_SIZE", "50"))
    reports_dir = Path(os.getenv("REPORTS_DIR", "reports"))
    reports_dir.mkdir(parents=True, exist_ok=True)
    plan_path = reports_dir / "merge_plan.json"
    errors_path = reports_dir / "errors.log"

    client = BitrixClient(webhook_url=webhook, request_delay=request_delay)
    client.call("user.current")
    companies = load_all_companies(client, page_size)
    reqs = load_company_requisites(client, [str(c["ID"]) for c in companies], page_size)

    rows = []
    owner_counts = Counter()
    with_inn = 0
    for company in companies:
        cid = str(company["ID"])
        identifiers = detect_company_identifiers(company, reqs.get(cid, []))
        owner_group = classify_owner(company.get("ASSIGNED_BY_ID"))
        owner_counts[owner_group] += 1
        if identifiers["inn"]:
            with_inn += 1
        rows.append({"company": company, "identifiers": identifiers, "owner_group": owner_group, "last_activity": None})

    groups = group_duplicates_by_inn(rows)
    group_company_ids = sorted({str(item["company"]["ID"]) for group in groups.values() for item in group})
    activities = load_group_activities(client, group_company_ids, page_size)
    for row in rows:
        cid = str(row["company"]["ID"])
        if cid in activities:
            row["last_activity"] = activities[cid]

    print(
        f"AUDIT total={len(companies)} with_valid_inn={with_inn} "
        f"without_valid_inn={len(companies)-with_inn} duplicate_groups={len(groups)} "
        f"owner_groups={dict(owner_counts)}"
    )
    if args.audit:
        return 0

    plan = build_merge_plan(
        groups,
        args.allow_unknown_user_merge,
        args.allow_ogrn_conflict_merge,
        args.allow_active_to_active_merge,
        client,
        page_size,
    )
    if args.dry_run:
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        errors_path.touch(exist_ok=True)
        print(
            f"DRY-RUN groups={len(plan['groups'])} "
            f"allowed={sum(1 for g in plan['groups'] if g['allowed_for_apply'])} "
            f"blocked={sum(1 for g in plan['groups'] if not g['allowed_for_apply'])}"
        )
        return 0

    if args.apply:
        fresh_plan = ensure_fresh_plan(plan_path)
        apply_merge_plan(client, fresh_plan, page_size, errors_path)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BitrixError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
