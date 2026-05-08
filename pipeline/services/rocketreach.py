import os
from typing import List, Dict

import requests


class RocketReachClient:

    SEARCH_URL = "https://api.rocketreach.co/v2/api/search"
    LOOKUP_URL = "https://api.rocketreach.co/v2/api/person/lookup"

    ROLE_MAPPINGS = {
        "CTO": "Chief Technology Officer",
        "CEO": "Chief Executive Officer",
        "CFO": "Chief Financial Officer",
        "COO": "Chief Operating Officer",
        "CMO": "Chief Marketing Officer",
        "VP Product": "Vice President Product",
        "Head of Partnerships": "Head of Partnerships",
        "Head of Engineering": "Head of Engineering",
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
        limit: int = 3,
    ) -> List[Dict]:

        search_role = self.ROLE_MAPPINGS.get(
            role,
            role
        )

        headers = {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "start": 1,
            "page_size": limit,
            "query": {
                "current_employer": [company],
                "current_title": [search_role]
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

        if not profiles:
            print(
                f"[RocketReach] No contacts found "
                f"for {company} ({search_role})"
            )
            return []

        enriched_contacts = []

        for profile in profiles:

            person_id = profile.get("id")

            if not person_id:
                continue

            enriched = self.lookup_person(
                person_id
            )

            if enriched:
                enriched_contacts.append(
                    enriched
                )

        return enriched_contacts

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

        if not valid_professional_email:
            print(
                f"[RocketReach] No valid "
                f"professional email found "
                f"for person {person_id}"
            )
            return {}

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

            "email_grade": "A",

            "email_verified": True,

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