import os
import re
from typing import List, Dict

import requests


class RocketReachClient:

    SEARCH_URL = "https://api.rocketreach.co/v2/api/search"
    LOOKUP_URL = "https://api.rocketreach.co/v2/api/person/lookup"

    ROLE_MAPPINGS = {
        "CTO": ["CTO", "Chief Technology Officer", "Chief Tech Officer"],
        "CEO": ["CEO", "Chief Executive Officer"],
        "CFO": ["CFO", "Chief Financial Officer"],
        "COO": ["COO", "Chief Operating Officer"],
        "CMO": ["CMO", "Chief Marketing Officer"],
        "VP Product": ["VP Product", "Vice President Product", "VP of Product"],
        "Head of Partnerships": ["Head of Partnerships", "Partnerships Head", "VP Partnerships"],
        "Head of Engineering": ["Head of Engineering", "VP Engineering", "Engineering Head"],
        "Compliance Head": ["Compliance Head", "Head of Compliance", "Chief Compliance Officer"],
    }

    def __init__(self):

        self.api_key = os.getenv("ROCKETREACH_API_KEY")

        if not self.api_key:
            raise ValueError(
                "ROCKETREACH_API_KEY not found"
            )

    def search_contacts(
        self,
        company: str,
        role: str,
        domain: str = "",
        limit: int = 3,
    ) -> List[Dict]:

        search_roles = self._role_variants(role)
        employer_variants = self._employer_variants(company, domain)

        headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "start": 1,
            "page_size": limit,
            "query": {
                "current_employer": employer_variants,
                "current_title": search_roles,
            }
        }

        print("\n========== SEARCH REQUEST ==========")
        print(payload)
        print("====================================\n")

        response = requests.post(
            self.SEARCH_URL,
            json=payload,
            headers=headers,
            timeout=20
        )

        print("\n========== SEARCH RESPONSE ==========")
        print("STATUS:", response.status_code)
        print(response.text[:1000])
        print("====================================\n")

        response.raise_for_status()

        data = response.json()

        profiles = data.get("profiles", [])
        profiles = self._filter_profiles(
            profiles,
            company,
            search_roles,
        )

        if not profiles:
            print(
                f"[RocketReach] No contacts found "
                f"for {company} ({', '.join(search_roles)})"
            )
            return []

        contacts = []

        for profile in profiles:
            contact = self._contact_from_search_profile(profile)
            if contact:
                contacts.append(contact)
            if len(contacts) >= limit:
                break

        return contacts

    def _contact_from_search_profile(self, profile: Dict) -> Dict:
        name = profile.get("name") or ""
        first_name, last_name = self._split_name(name)
        domain = self._professional_domain(profile)
        estimated_email = self._estimate_email(first_name, last_name, domain)

        return {
            "id": str(profile.get("id")),
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "title": profile.get("current_title"),
            "company": profile.get("current_employer"),
            "linkedin": profile.get("linkedin_url"),
            "location": profile.get("location"),
            "email": estimated_email,
            "email_grade": None,
            "email_verified": False,
            "email_source": "estimated",
            "company_domain": domain or profile.get("current_employer_domain"),
            "company_website": profile.get("current_employer_website"),
            "source": "rocketreach_search",
            "status": "unverified",
        }

    def _split_name(self, name: str) -> tuple[str, str]:
        parts = [
            part
            for part in re.split(r"\s+", name.strip())
            if part and len(part) > 1
        ]
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], parts[-1]

    def _professional_domain(self, profile: Dict) -> str:
        teaser = profile.get("teaser") or {}
        professional_domains = teaser.get("professional_emails") or []
        if professional_domains:
            return professional_domains[0]
        return profile.get("current_employer_domain") or ""

    def _estimate_email(self, first_name: str, last_name: str, domain: str) -> str:
        if not first_name or not domain:
            return ""

        first = self._email_part(first_name)
        last = self._email_part(last_name)

        if first and last:
            return f"{first}.{last}@{domain}"
        return f"{first}@{domain}"

    def _email_part(self, value: str) -> str:
        return re.sub(r"[^a-z0-9]", "", value.lower())

    def _role_variants(self, role: str) -> List[str]:
        variants = self.ROLE_MAPPINGS.get(role, [role])
        return self._unique([role, *variants])

    def _employer_variants(self, company: str, domain: str = "") -> List[str]:
        variants = [company]
        cleaned_company = re.sub(
            r"\b(inc|inc\.|ltd|ltd\.|limited|pvt|private|plc|llc|corp|corporation)\b",
            "",
            company,
            flags=re.IGNORECASE,
        ).strip(" -,.")
        if cleaned_company:
            variants.append(cleaned_company)

        if domain:
            domain_root = domain.lower().removeprefix("www.").split(".")[0]
            if domain_root:
                variants.append(domain_root)
                variants.append(domain_root.title())

        return self._unique(variants)

    def _filter_profiles(
        self,
        profiles: List[Dict],
        company: str,
        role_variants: List[str],
    ) -> List[Dict]:
        company_key = self._normalize_match_text(company)
        role_keys = [
            self._normalize_match_text(role)
            for role in role_variants
        ]
        filtered = []

        for profile in profiles:
            employer = self._normalize_match_text(
                profile.get("current_employer", "")
            )
            title = self._normalize_match_text(
                profile.get("current_title", "")
            )

            employer_matches = (
                company_key
                and (
                    employer == company_key
                    or employer.startswith(f"{company_key} ")
                    or f" {company_key} " in f" {employer} "
                )
            )
            title_matches = any(
                role_key and (
                    role_key in title
                    or title in role_key
                )
                for role_key in role_keys
            )

            if employer_matches and title_matches:
                filtered.append(profile)
            else:
                print(
                    "[RocketReach] Skipping unmatched profile before lookup: "
                    f"{profile.get('name')} | {profile.get('current_title')} | "
                    f"{profile.get('current_employer')}"
                )

        return filtered

    def _normalize_match_text(self, value: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", " ", str(value).lower())
        return " ".join(normalized.split())

    def _unique(self, values: List[str]) -> List[str]:
        seen = set()
        unique_values = []
        for value in values:
            normalized = " ".join(str(value).split())
            key = normalized.lower()
            if normalized and key not in seen:
                seen.add(key)
                unique_values.append(normalized)
        return unique_values

    def lookup_person(
        self,
        person_id: int
    ) -> Dict:

        headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

        url = (
            f"{self.LOOKUP_URL}"
            f"?id={person_id}"
        )

        print("\n========== LOOKUP REQUEST ==========")
        print(url)
        print("====================================\n")

        response = requests.get(
            url,
            headers=headers,
            timeout=20
        )

        print("\n========== LOOKUP RESPONSE ==========")
        print("STATUS:", response.status_code)
        print(response.text[:1500])
        print("====================================\n")

        response.raise_for_status()

        data = response.json()

        emails = data.get("emails", [])

        valid_professional_email = None

        for email_obj in emails:

            if (
                email_obj.get("type") == "professional"
                and email_obj.get("smtp_valid") == "valid"
                and email_obj.get("grade") == "A"
            ):

                valid_professional_email = (
                    email_obj.get("email")
                )

                break

        return {
            "id": data.get("id"),

            "name": data.get("name"),

            "title": data.get(
                "current_title"
            ),

            "company": data.get(
                "current_employer"
            ),

            "linkedin": data.get(
                "linkedin_url"
            ),

            "location": data.get(
                "location"
            ),

            "email": valid_professional_email,

            "email_grade": "A" if valid_professional_email else None,

            "email_verified": bool(valid_professional_email),

            "company_domain": data.get(
                "current_employer_domain"
            ),

            "company_website": data.get(
                "current_employer_website"
            ),

            "source": "rocketreach",

            "status": "new",
        }


rocketreach_client = RocketReachClient()

__all__ = ["rocketreach_client"]
