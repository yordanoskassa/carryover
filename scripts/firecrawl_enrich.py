#!/usr/bin/env python3
"""
Firecrawl enrichment → Elasticsearch.

For destinations whose government sites hide fees/funds behind links or PDFs the
Elastic Open Crawler can't follow, we use Firecrawl's structured `extract` to pull
the exact figures, then index them into the `structured-policies` index keyed as
ALL-<dest>-<purpose>. The Advisor treats these as authoritative for every
nationality on that route.

This keeps Elasticsearch the single source the agent searches; Firecrawl is just a
supplementary ingestion path for the gap pages. The POLICIES below are the verbatim
output of Firecrawl extract runs (see git history / the chat that produced them).
"""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from elasticsearch import Elasticsearch

es = Elasticsearch(
    os.environ["ELASTICSEARCH_URL"] + ":443",
    api_key=os.environ["ELASTICSEARCH_API_KEY"],
    request_timeout=60,
)

STRUCTURED_INDEX = "structured-policies"

# Each entry is Firecrawl-extracted official data for one route.
POLICIES = [
    {
        "destination": "IE", "purpose": "student",
        "visa_name": "Long Stay (Type D) Student Visa",
        "summary": ("A long-stay study visa for non-EU students accepted onto an approved "
                    "course in Ireland for more than 90 days. You must show sufficient funds "
                    "and hold private medical insurance."),
        "fee": "€60 single entry / €100 multiple entry",
        "processing_time": "approximately 8 weeks",
        "key_requirements": [
            "Acceptance onto an approved course (on the ILEP list)",
            "Evidence of at least €7,000 per year in available funds",
            "Private medical insurance",
            "Evidence of English language proficiency",
        ],
        "documents": [
            "Passport and passport photographs",
            "Letter of acceptance from the college",
            "Proof of course fee payment",
            "Financial summary form / evidence of funds",
            "Private medical insurance",
            "Evidence of English language ability",
            "Accommodation details",
        ],
        "steps": [
            "Get accepted onto an approved course and pay the course fees",
            "Create your visa application online via AVATS",
            "Pay the visa fee (€60 single / €100 multiple entry)",
            "Submit the signed summary form with your supporting documents",
        ],
        "source_name": "Irish Immigration Service",
        "source_url": "https://www.irishimmigration.ie/coming-to-study-in-ireland/",
    },
    {
        "destination": "NO", "purpose": "student",
        "visa_name": "Study Permit (Norway)",
        "summary": ("A residence permit for non-EU/EEA students admitted full-time to a Norwegian "
                    "university or university college. You must prove you can support yourself and "
                    "have somewhere to live."),
        "fee": "NOK 5,400",
        "processing_time": "up to 12 months",
        "key_requirements": [
            "Admission to an approved university or university college",
            "Full-time study",
            "Proof of at least NOK 170,368 per year in available funds",
            "Confirmed accommodation in Norway",
        ],
        "documents": [
            "Valid passport",
            "Confirmation of admission to an approved institution",
            "Proof of sufficient funds (bank statements, scholarship letters)",
            "Health insurance documentation",
            "Proof of accommodation in Norway",
        ],
        "steps": [
            "Get admitted to an approved Norwegian institution",
            "Register an application in the UDI application portal and pay the fee",
            "Book and attend an appointment to hand in documents",
            "Wait for the decision (can take up to 12 months)",
        ],
        "source_name": "Norwegian Directorate of Immigration (UDI)",
        "source_url": "https://www.udi.no/en/want-to-apply/studies/",
    },
    {
        "destination": "FI", "purpose": "student",
        "visa_name": "Residence Permit for Studies (Finland)",
        "summary": ("A residence permit for non-EU students accepted to a Finnish educational "
                    "institution. You must show sufficient funds and hold health insurance."),
        "fee": "€600 (online) / €750 (paper)",
        "processing_time": "studies applications are high-priority; varies by case",
        "key_requirements": [
            "Acceptance at a Finnish educational institution",
            "At least €9,600 for one year (or €800 per month) in available funds",
            "Valid health insurance",
        ],
        "documents": [
            "Valid passport",
            "Passport photo",
            "Certificate of acceptance from the educational institution",
            "Proof of financial resources",
            "Certificate of insurance",
        ],
        "steps": [
            "Get accepted to a Finnish educational institution",
            "Fill in the studies application in Enter Finland and pay the fee",
            "Visit a Finnish mission or service point to prove your identity",
            "Wait for the decision",
        ],
        "source_name": "Finnish Immigration Service (Migri)",
        "source_url": "https://migri.fi/en/studying-in-finland",
    },
    {
        "destination": "AU", "purpose": "student",
        "visa_name": "Student visa (subclass 500)",
        "summary": ("Australia's student visa for international students enrolled full-time in a "
                    "registered course. You must show genuine intent, funds, and health cover."),
        "fee": "AUD 2,000",
        "processing_time": "varies by course and case",
        "key_requirements": [
            "Enrolled full-time with a Confirmation of Enrolment (CoE)",
            "Living-costs funds of about AUD 29,710 per year (more for dependents)",
            "Overseas Student Health Cover (OSHC)",
            "Meet the Genuine Student requirement",
        ],
        "documents": ["Valid passport", "Confirmation of Enrolment (CoE)",
                      "Evidence of financial capacity", "Overseas Student Health Cover (OSHC)",
                      "Identity documents"],
        "steps": ["Get a Confirmation of Enrolment from a registered provider",
                  "Create an ImmiAccount and lodge the subclass 500 application",
                  "Pay the visa fee and provide funds + OSHC evidence",
                  "Complete health checks/biometrics if requested and await the decision"],
        "source_name": "Australia Department of Home Affairs",
        "source_url": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
    },
    {
        "destination": "NL", "purpose": "student",
        "visa_name": "Student Residence Permit (university / higher professional education)",
        "summary": ("A residence permit for non-EU students enrolled full-time at a recognised "
                    "Dutch institution. The institution usually applies on your behalf."),
        "fee": "€254",
        "processing_time": "up to 90 days",
        "key_requirements": [
            "Enrolled full-time at a recognised institution",
            "At least €1,130.77 per month in available funds",
            "Health insurance in the Netherlands",
            "TB test within 3 months of arrival (some nationalities)",
        ],
        "documents": ["Copy of passport", "Proof of sufficient funds",
                      "Legalised and translated birth certificate", "Proof of enrolment"],
        "steps": ["Get accepted at a recognised Dutch institution",
                  "The institution submits your entry (MVV) and residence-permit application",
                  "Pay the fee and provide funds + insurance evidence",
                  "Collect your MVV and complete the TB test if required"],
        "source_name": "IND Netherlands",
        "source_url": "https://ind.nl/en/study/studying-in-the-netherlands",
    },
    {
        "destination": "SE", "purpose": "student",
        "visa_name": "Residence Permit for Higher Education Studies",
        "summary": ("A residence permit for non-EU students admitted to full-time higher education "
                    "in Sweden, with tuition paid and self-support shown."),
        "fee": "SEK 1,500",
        "processing_time": "about 2 months",
        "key_requirements": [
            "Admitted to full-time studies",
            "Tuition fees paid before applying",
            "At least SEK 10,656 per month in available funds",
            "Comprehensive health insurance",
        ],
        "documents": ["Copy of passport", "Admission decision from the institution",
                      "Proof of health insurance", "Proof of financial maintenance"],
        "steps": ["Get admitted and pay your first tuition instalment",
                  "Apply online via Migrationsverket and pay the fee",
                  "Upload admission, funds and insurance evidence",
                  "Await the decision (about 2 months)"],
        "source_name": "Swedish Migration Agency",
        "source_url": "https://www.migrationsverket.se/en/you-want-to-apply/studies/higher-education.html",
    },
    {
        "destination": "NZ", "purpose": "student",
        "visa_name": "Fee Paying Student Visa",
        "summary": ("New Zealand's student visa for those offered a place by an approved education "
                    "provider, with tuition and living funds shown."),
        "fee": "from NZD 850",
        "processing_time": "80% within about 9.5 weeks",
        "key_requirements": [
            "Offered a place by an approved education provider",
            "Funds for tuition (or a scholarship)",
            "Living funds of about NZD 20,000 per year (or NZD 1,667/month for shorter study)",
            "Acceptable insurance",
        ],
        "documents": ["Passport or certificate of identity", "Acceptable photo",
                      "Evidence of an offer of place", "Evidence tuition is paid or covered",
                      "Evidence of living funds", "Onward travel evidence"],
        "steps": ["Get an offer of place from an approved provider",
                  "Apply online and pay the fee",
                  "Provide tuition, funds and insurance evidence",
                  "Complete health/character checks if required and await the decision"],
        "source_name": "Immigration New Zealand",
        "source_url": "https://www.immigration.govt.nz/new-zealand-visas/options/study",
    },
    {
        "destination": "SG", "purpose": "student",
        "visa_name": "Student's Pass",
        "summary": ("Singapore's pass for international students accepted into an approved full-time "
                    "course, applied for through the SOLAR system."),
        "fee": "S$45 (S$30 application + S$60 issuance)",
        "processing_time": "within about 1 week",
        "key_requirements": [
            "Accepted into an approved full-time course in Singapore",
            "Must not hold a conflicting pass (Dependant's Pass, LTVP, etc.)",
        ],
        "documents": ["Registration Acknowledgement Letter from the school",
                      "Travel document biodata page", "Recent passport-sized photograph",
                      "Personal, education and financial details"],
        "steps": ["Get accepted; the school registers you in SOLAR",
                  "Submit eForm 16 and pay the application fee",
                  "On approval, complete formalities and pay the issuance fee",
                  "Collect your Student's Pass"],
        "source_name": "Singapore ICA",
        "source_url": "https://www.ica.gov.sg/reside/STP",
    },
    {
        "destination": "FR", "purpose": "student",
        "visa_name": "Long-stay student visa (VLS-TS étudiant)",
        "summary": ("France's long-stay student visa, valid as a residence permit, for non-EU "
                    "students accepted by a higher-education institution."),
        "fee": "€99",
        "processing_time": "about 15 days",
        "key_requirements": [
            "At least 18 years old",
            "Accepted by a higher-education institution",
            "Financial resources of about €615 per month",
        ],
        "documents": ["Certificate of enrolment", "Proof of financial resources",
                      "Passport", "Two recent ID photos"],
        "steps": ["Get accepted (via Études en France where applicable)",
                  "Complete the France-Visas application and pay the fee",
                  "Submit documents at the visa centre",
                  "Validate the VLS-TS online after arrival in France"],
        "source_name": "France-Visas",
        "source_url": "https://france-visas.gouv.fr/en/web/france-visas/student",
    },
    {
        "destination": "JP", "purpose": "student",
        "visa_name": "Student Visa (College Student / ryugaku)",
        "summary": ("Japan's student visa, granted after a Certificate of Eligibility is obtained "
                    "by your school, for full-time study in Japan."),
        "fee": "¥3,000 (single entry)",
        "processing_time": "about 5 working days after Certificate of Eligibility",
        "key_requirements": [
            "Certificate of Eligibility obtained by the receiving school",
            "Sufficient funds for tuition and living costs",
        ],
        "documents": ["Visa application form", "Passport", "Photograph",
                      "Certificate of Eligibility", "Proof of financial support"],
        "steps": ["School applies for your Certificate of Eligibility in Japan",
                  "Submit the visa application with the CoE at a Japanese mission",
                  "Pay the visa fee",
                  "Collect your visa (about 5 working days)"],
        "source_name": "Japan Ministry of Foreign Affairs",
        "source_url": "https://www.mofa.go.jp/j_info/visit/visa/long/index.html",
    },
    {
        "destination": "CH", "purpose": "student",
        "visa_name": "Student Residence Permit (Switzerland)",
        "summary": ("A residence permit for non-EU/EFTA students accepted at a recognised Swiss "
                    "institution, with proof of funds and insurance."),
        "fee": "CHF 160",
        "processing_time": "8–12 weeks",
        "key_requirements": [
            "Accepted at a recognised Swiss institution",
            "At least CHF 21,000 per year in available funds",
            "Health insurance coverage",
            "No criminal record",
        ],
        "documents": ["Valid passport", "Proof of acceptance",
                      "Proof of financial means", "Health insurance certificate",
                      "Passport-sized photographs"],
        "steps": ["Get accepted at a recognised Swiss institution",
                  "Apply for the national (D) visa at the Swiss representation",
                  "Provide funds, insurance and acceptance evidence",
                  "On arrival, register with the cantonal migration office"],
        "source_name": "Swiss State Secretariat for Migration",
        "source_url": "https://www.sem.admin.ch/sem/en/home/themen/aufenthalt/nicht_eu_efta.html",
    },
    {
        "destination": "ES", "purpose": "student",
        "visa_name": "National Student Visa (estancia por estudios)",
        "summary": ("Spain's national visa for non-EU students admitted to an authorised institution "
                    "for more than 90 days, with IPREM-based proof of means."),
        "fee": "about €100 (varies by consulate)",
        "processing_time": "up to 3 months",
        "key_requirements": [
            "Admission to an authorised Spanish institution",
            "Means of at least 100% of IPREM per month (about €600), more for dependents",
            "Health insurance",
            "Criminal-record certificate if staying over 180 days",
            "Medical certificate",
        ],
        "documents": ["National visa application form", "Recent photograph", "Valid passport",
                      "Proof of admission and tuition payment", "Proof of financial means",
                      "Health insurance", "Criminal-record certificate (if applicable)",
                      "Medical certificate"],
        "steps": ["Get admitted to an authorised institution",
                  "Book a consulate appointment and submit the national-visa application",
                  "Provide funds, insurance and (if needed) criminal-record + medical certificates",
                  "Collect the visa and apply for the TIE card after arrival"],
        "source_name": "Spain Ministry of Foreign Affairs",
        "source_url": "https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/Visados.aspx",
    },
    {
        "destination": "AT", "purpose": "student",
        "visa_name": "Residence Permit – Student (Aufenthaltsbewilligung Studierende)",
        "summary": ("Austria's residence permit for non-EU students admitted to a recognised "
                    "Austrian higher-education institution, with proof of funds and full health cover."),
        "fee": "€218",
        "processing_time": "up to 90 days",
        "key_requirements": [
            "Admission to a recognised Austrian higher-education institution",
            "Proof of funds: €722.58/month (under 24) or €1,308.39/month (24+)",
            "Health insurance covering all risks",
            "Proof of accommodation in Austria",
        ],
        "documents": [
            "Valid passport", "Passport-sized photograph",
            "Letter of admission from the Austrian institution",
            "Proof of sufficient financial means", "Proof of accommodation",
            "Health insurance covering all risks",
            "Police clearance certificate (if applicable)",
        ],
        "steps": [
            "Get a letter of admission from an Austrian institution",
            "Submit the residence-permit application at the Austrian representation",
            "Provide funds, insurance and accommodation evidence",
            "Collect the permit (processing up to 90 days)",
        ],
        "source_name": "Austria Migration Authority (migration.gv.at)",
        "source_url": "https://www.migration.gv.at/en/types-of-immigration/permanent-immigration/students/",
    },
    {
        "destination": "AT", "purpose": "work",
        "visa_name": "Red-White-Red Card",
        "summary": ("Austria's points-based work and residence permit for skilled non-EU workers. "
                    "You need a qualifying job offer and enough points across qualification, "
                    "experience, language, and age."),
        "fee": "€218",
        "processing_time": "varies by case",
        "key_requirements": [
            "A qualifying job offer from an Austrian employer",
            "At least 55 points (qualification, work experience, language skills, age)",
            "Minimum gross salary around €3,465/month (2026)",
            "Health insurance covering all risks",
        ],
        "documents": [
            "Valid passport", "Recent photo (45x35mm)",
            "Employment contract or binding job offer",
            "Evidence of qualifications and work experience",
            "Proof of health insurance",
            "Evidence of adequate means of subsistence (pay slips, contract)",
        ],
        "steps": [
            "Secure a qualifying job offer from an Austrian employer",
            "The employer or you submit the Red-White-Red Card application",
            "Provide qualification, salary and insurance evidence",
            "Receive the combined work + residence permit",
        ],
        "source_name": "Austria Migration Authority (migration.gv.at)",
        "source_url": "https://www.migration.gv.at/en/types-of-immigration/permanent-immigration/red-white-red-card/",
    },
    {
        "destination": "GR", "purpose": "student",
        "visa_name": "National (Type D) Student Visa",
        "summary": ("Greece's national long-stay visa for non-EU students accepted to a Greek "
                    "institution for more than 90 days, with proof of funds and health cover."),
        "fee": "€100",
        "processing_time": "2-3 months",
        "key_requirements": [
            "Acceptance letter from a Greek educational institution",
            "At least €7,200 per year in available funds",
            "Health insurance coverage",
            "Proof of accommodation in Greece",
        ],
        "documents": [
            "Completed visa application form", "Passport-sized photographs",
            "Acceptance letter from the institution", "Proof of financial means",
            "Health insurance certificate", "Proof of accommodation",
            "Proof of visa fee payment",
        ],
        "steps": [
            "Get an acceptance letter from a Greek institution",
            "Book a consulate appointment and submit the national (type D) application",
            "Provide funds, insurance and accommodation evidence",
            "After arrival, apply for the residence permit",
        ],
        "source_name": "Greek Ministry of Migration and Asylum",
        "source_url": "https://migration.gov.gr/en/",
    },
    {
        "destination": "IT", "purpose": "student",
        "visa_name": "National Visa (Type D) for Study",
        "summary": ("Italy's long-stay study visa for non-EU students with an acceptance letter, "
                    "proof of means, accommodation and health cover."),
        "fee": None,
        "processing_time": None,
        "key_requirements": [
            "Acceptance letter from an Italian institution",
            "Proof of sufficient financial means",
            "Health insurance coverage",
            "Valid passport",
        ],
        "documents": ["Completed visa application form", "Passport-sized photographs",
                      "Proof of accommodation in Italy", "Proof of financial means",
                      "Health insurance certificate"],
        "steps": ["Get an acceptance letter from an Italian institution",
                  "Book a consulate appointment and submit the type-D application",
                  "Provide means, accommodation and insurance evidence",
                  "Apply for the residence permit (permesso di soggiorno) within 8 days of arrival"],
        "source_name": "Italy MFA Visa Portal",
        "source_url": "https://vistoperitalia.esteri.it/home/en",
    },
]


def index_policy(p: dict) -> str:
    route_id = f"ALL-{p['destination']}-{p['purpose']}"
    doc = {
        "route": route_id,
        "nationality": "ALL",
        "destination": p["destination"],
        "purpose": p["purpose"],
        "found": True,
        "ai_structured": False,
        "firecrawl_sourced": True,
        "visa_name": p["visa_name"],
        "summary": p["summary"],
        "fee": p.get("fee"),
        "processing_time": p.get("processing_time"),
        "key_requirements": p.get("key_requirements", []),
        "documents": p.get("documents", []),
        "steps": p.get("steps", []),
        "source_name": p.get("source_name"),
        "source_url": p.get("source_url"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    es.index(index=STRUCTURED_INDEX, id=route_id, document=doc, refresh="wait_for")
    return route_id


if __name__ == "__main__":
    if not es.indices.exists(index=STRUCTURED_INDEX):
        es.indices.create(index=STRUCTURED_INDEX)
    for p in POLICIES:
        rid = index_policy(p)
        print(f"  indexed {rid}: {p['visa_name']} — {p.get('fee')}")
    print(f"Done: {len(POLICIES)} Firecrawl-curated policies indexed.")
