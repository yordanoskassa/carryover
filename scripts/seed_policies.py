#!/usr/bin/env python3
"""Seed comprehensive visa policy data into Elasticsearch."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ.setdefault("ELASTICSEARCH_URL", "https://my-observability-project-acf12a.es.us-central1.gcp.elastic.cloud")
os.environ.setdefault("ELASTICSEARCH_API_KEY", "Uk5DX3JaNEJqMVpqTUpfN0tEYVg6ZEkzaGV3U0k1U2lxcmFXRnpXaVd0Zw==")

import importlib
import app.services.elastic as emod
importlib.reload(emod)
from app.services.elastic import es, bulk_index

# Clear old data
es.delete_by_query(index="visa-policies", body={"query": {"match_all": {}}}, refresh=True)
print("Cleared old visa-policies")

policies = [
    # ── ETHIOPIA -> UK ────────────────────────────────────────────
    {"nationality":"ET","destination":"GB","purpose":"student",
     "requirement_text":"Ethiopian nationals require a UK Student visa (formerly Tier 4) to study in the United Kingdom. You must have a valid passport with at least 6 months validity, a Confirmation of Acceptance for Studies (CAS) from a licensed Student sponsor, proof of English language proficiency (IELTS Academic 6.0 overall, minimum 5.5 in each component for degree level), and evidence of sufficient maintenance funds (at least GBP 1,334 per month for up to 9 months if studying in London, or GBP 1,023 outside London). Funds must be held for a consecutive 28-day period.",
     "documents_needed":"Valid passport (6+ months), CAS reference number, IELTS/TOEFL certificate, bank statements showing 28 consecutive days of sufficient funds, TB test certificate from IOM Addis Ababa, passport-sized photographs, academic transcripts and certificates, ATAS certificate (for certain STEM subjects)",
     "fee_usd":490,"processing_days":15,
     "source_url":"https://www.gov.uk/student-visa","source_name":"UK Home Office",
     "last_updated":"2026-05-01","language":"en"},
    {"nationality":"ET","destination":"GB","purpose":"student",
     "requirement_text":"UK Student visa application process: attend a visa appointment at VFS Global in Addis Ababa. Complete online application, pay visa fee (GBP 490) and Immigration Health Surcharge (GBP 776 per year). Biometric data collected at appointment. Processing takes 3 weeks. Priority service (5 working days) available for additional fee. CAS must be assigned no more than 6 months before course start date. You may apply up to 6 months before your course starts.",
     "documents_needed":"Online application printout, appointment confirmation, IHS payment reference, biometric enrollment receipt, original passport",
     "fee_usd":490,"processing_days":15,
     "source_url":"https://www.gov.uk/student-visa/apply","source_name":"UK Home Office",
     "last_updated":"2026-05-01","language":"en"},

    {"nationality":"ET","destination":"GB","purpose":"work",
     "requirement_text":"Ethiopian nationals need a UK Skilled Worker visa to work in the United Kingdom. Requirements: a job offer from a UK employer holding a valid sponsor licence, a certificate of sponsorship (CoS) with details of the role, meeting the minimum salary threshold of GBP 38,700 per year or the going rate for the occupation (whichever is higher), and English language ability at B1 level (IELTS 4.0 in each component). Some occupations on the Immigration Salary List have reduced salary thresholds.",
     "documents_needed":"Valid passport, certificate of sponsorship reference number, proof of English language (IELTS or degree taught in English), criminal record certificate from Ethiopian Federal Police, TB test certificate, bank statements showing GBP 1,270 held for 28 days",
     "fee_usd":719,"processing_days":21,
     "source_url":"https://www.gov.uk/skilled-worker-visa","source_name":"UK Home Office",
     "last_updated":"2026-04-15","language":"en"},
    {"nationality":"ET","destination":"GB","purpose":"work",
     "requirement_text":"Health and Care Worker visa is available for Ethiopian nationals with a job offer in an eligible health or social care role. Lower fees (GBP 284) and exempt from Immigration Health Surcharge. Employer must be CQC-registered or NHS. Minimum salary GBP 23,200 or the going rate. Allows dependants and leads to settlement after 5 years.",
     "documents_needed":"Valid passport, CoS from eligible health employer, proof of English at B1 level, criminal record certificate, TB test certificate",
     "fee_usd":370,"processing_days":21,
     "source_url":"https://www.gov.uk/health-care-worker-visa","source_name":"UK Home Office",
     "last_updated":"2026-04-15","language":"en"},

    {"nationality":"ET","destination":"GB","purpose":"family",
     "requirement_text":"Ethiopian nationals can apply for a UK Family visa to join a British citizen or settled person. Sponsor must have annual income of at least GBP 29,000 (increasing to GBP 34,500 from 2027). Applicant must pass English language test at A1 level. Relationship must be genuine and subsisting. Couple must have met in person. Visa initially granted for 33 months, leads to settlement after 5 years.",
     "documents_needed":"Valid passport, proof of relationship (marriage certificate, photos, communication records), sponsor financial evidence (payslips, P60, bank statements 6 months), English test certificate (A1), TB test, accommodation evidence",
     "fee_usd":1846,"processing_days":60,
     "source_url":"https://www.gov.uk/uk-family-visa","source_name":"UK Home Office",
     "last_updated":"2026-03-20","language":"en"},

    {"nationality":"ET","destination":"GB","purpose":"tourist",
     "requirement_text":"Ethiopian nationals require a Standard Visitor visa to visit the UK for tourism, visiting family, or business meetings. Allows stays of up to 6 months. Must demonstrate intent to leave, sufficient funds, and not intend to work or study. Cannot switch to most other visa categories from within the UK.",
     "documents_needed":"Valid passport, online application, bank statements (6 months), employment letter, travel itinerary, hotel bookings, invitation letter (if visiting family), TB test certificate",
     "fee_usd":130,"processing_days":15,
     "source_url":"https://www.gov.uk/standard-visitor","source_name":"UK Home Office",
     "last_updated":"2026-05-10","language":"en"},

    # ── ETHIOPIA -> US ────────────────────────────────────────────
    {"nationality":"ET","destination":"US","purpose":"student",
     "requirement_text":"Ethiopian nationals require an F-1 Student Visa for US academic study. Must be accepted by SEVP-approved school, receive Form I-20, pay SEVIS fee ($350), complete DS-160, attend interview at US Embassy Addis Ababa. Must demonstrate nonimmigrant intent, sufficient funding for entire program, and academic qualifications. OPT (Optional Practical Training) allows 12 months post-graduation work.",
     "documents_needed":"Valid passport (6+ months), Form I-20, SEVIS receipt ($350), DS-160 confirmation, visa fee ($185), photos (2x2 in), financial evidence, academic transcripts, test scores (TOEFL/SAT/GRE), proof of ties to Ethiopia",
     "fee_usd":185,"processing_days":30,
     "source_url":"https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html","source_name":"US Department of State",
     "last_updated":"2026-05-20","language":"en"},

    {"nationality":"ET","destination":"US","purpose":"work",
     "requirement_text":"Ethiopian nationals need employer-sponsored work visa. H-1B for specialty occupations requiring bachelors degree. Employer files LCA and I-129 petition. Annual cap: 65,000 + 20,000 for US masters holders. Lottery in March. Other options: L-1 (intracompany transfer), O-1 (extraordinary ability), EB categories for permanent residency. Premium processing available ($2,805).",
     "documents_needed":"Valid passport, approved I-129 petition, DS-160, visa fee ($205), LCA approval, degree certificates, employment offer letter, resume/CV",
     "fee_usd":205,"processing_days":60,
     "source_url":"https://travel.state.gov/content/travel/en/us-visas/employment/temporary-worker-visas.html","source_name":"US Department of State",
     "last_updated":"2026-04-01","language":"en"},

    {"nationality":"ET","destination":"US","purpose":"family",
     "requirement_text":"Family-sponsored immigration for Ethiopian nationals. US citizens can petition for spouses (IR-1/CR-1), parents (IR-5), children (IR-2), siblings (F4). Permanent residents petition for spouses (F2A) and unmarried children (F2B). Wait times: immediate relatives no quota; sibling category 15-20 year waits. Petitioner files Form I-130, beneficiary applies at US Embassy Addis Ababa.",
     "documents_needed":"Valid passport, approved I-130, DS-260, birth certificate, marriage certificate, police clearance, medical exam, affidavit of support (I-864), sponsor financial evidence",
     "fee_usd":325,"processing_days":365,
     "source_url":"https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration.html","source_name":"US Department of State",
     "last_updated":"2026-03-15","language":"en"},

    {"nationality":"ET","destination":"US","purpose":"tourist",
     "requirement_text":"Ethiopian nationals require B-1/B-2 visitor visa for US tourism. Refusal rate exceeds 50%. Must demonstrate strong ties to Ethiopia (employment, property, family), sufficient funds, clear travel purpose, and intent to return. Maximum stay 6 months. Cannot work or study.",
     "documents_needed":"Valid passport (6+ months), DS-160, visa fee ($185), photos, bank statements (6 months), employment letter, property documents, travel itinerary, hotel reservations, invitation letter",
     "fee_usd":185,"processing_days":14,
     "source_url":"https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html","source_name":"US Department of State",
     "last_updated":"2026-05-01","language":"en"},

    # ── NIGERIA -> US ─────────────────────────────────────────────
    {"nationality":"NG","destination":"US","purpose":"student",
     "requirement_text":"Nigerian nationals need F-1 Student Visa. Apply at US Embassy Abuja or Consulate Lagos. Nigeria has one of the highest student visa volumes globally. Must prove strong ties to Nigeria, intent to return, and sufficient funding for entire program. Interview is mandatory and highly competitive.",
     "documents_needed":"Valid passport (6+ months), Form I-20, SEVIS receipt, DS-160, bank statements, sponsor letter, admission letter, academic transcripts, TOEFL/IELTS scores, test scores",
     "fee_usd":185,"processing_days":45,
     "source_url":"https://ng.usembassy.gov/visas/nonimmigrant-visas/student-visa/","source_name":"US Embassy Nigeria",
     "last_updated":"2026-04-01","language":"en"},

    {"nationality":"NG","destination":"US","purpose":"work",
     "requirement_text":"Nigerian nationals seeking US employment need employer-sponsored visa. H-1B lottery receives 400,000+ registrations for 85,000 slots. Premium processing $2,805 for 15-day adjudication. L-1 intracompany transfer common for multinationals. EB-1/EB-2/EB-3 for permanent residence. Nigerian nationals face shorter green card wait than Indian nationals.",
     "documents_needed":"Valid passport, approved I-129 petition, DS-160, visa fee ($205), degree certificates, professional licenses, employment offer letter, evidence of specialty occupation",
     "fee_usd":205,"processing_days":90,
     "source_url":"https://ng.usembassy.gov/visas/nonimmigrant-visas/","source_name":"US Embassy Nigeria",
     "last_updated":"2026-04-01","language":"en"},

    {"nationality":"NG","destination":"US","purpose":"tourist",
     "requirement_text":"Nigerian nationals need B-1/B-2 visa. Nigeria has one of the highest refusal rates globally (over 50%). Strong documentation of ties to Nigeria essential: employment, property, family. Prior international travel history significantly improves chances.",
     "documents_needed":"Valid passport, DS-160, visa fee ($185), bank statements (6+ months), employment letter, business registration, property documents, tax returns, travel itinerary, previous visa copies",
     "fee_usd":185,"processing_days":14,
     "source_url":"https://ng.usembassy.gov/visas/nonimmigrant-visas/visitor-visa/","source_name":"US Embassy Nigeria",
     "last_updated":"2026-05-01","language":"en"},

    # ── NIGERIA -> UK ─────────────────────────────────────────────
    {"nationality":"NG","destination":"GB","purpose":"student",
     "requirement_text":"Nigerian nationals need UK Student visa. CAS from licensed sponsor required, IELTS 5.5 for foundation or 6.0 for degree (no component below 5.5), TB test from approved clinic in Lagos or Abuja, maintenance funds GBP 1,334/month London or GBP 1,023 outside London held for 28 days. Nigeria is a top source country for UK student visas.",
     "documents_needed":"Valid passport, CAS reference, IELTS certificate, TB test certificate, financial documents (28 days), ATAS certificate (if applicable), academic qualifications",
     "fee_usd":490,"processing_days":21,
     "source_url":"https://www.gov.uk/student-visa","source_name":"UK Home Office",
     "last_updated":"2026-05-01","language":"en"},

    {"nationality":"NG","destination":"GB","purpose":"work",
     "requirement_text":"Nigerian nationals require UK Skilled Worker visa. Employer must hold sponsor licence and assign CoS. Minimum salary GBP 38,700/year or going rate. English B1 level. Criminal record certificate from Nigeria Police Force required. Health and Care Worker visa available with lower fees for eligible roles.",
     "documents_needed":"Valid passport, CoS reference, English language evidence, Nigeria Police Force clearance, TB test, bank statements, qualification certificates",
     "fee_usd":719,"processing_days":21,
     "source_url":"https://www.gov.uk/skilled-worker-visa","source_name":"UK Home Office",
     "last_updated":"2026-04-15","language":"en"},

    {"nationality":"NG","destination":"GB","purpose":"tourist",
     "requirement_text":"Nigerian nationals need Standard Visitor visa for UK tourism. Maximum 6 months. Must demonstrate sufficient funds, intent to leave, genuine purpose. Apply at VFS Global in Lagos or Abuja. High scrutiny — strong documentation of ties to Nigeria essential.",
     "documents_needed":"Valid passport, online application, bank statements (6 months), employment letter, travel itinerary, hotel bookings, invitation letter, TB test, photos",
     "fee_usd":130,"processing_days":15,
     "source_url":"https://www.gov.uk/standard-visitor","source_name":"UK Home Office",
     "last_updated":"2026-05-10","language":"en"},

    # ── INDIA -> CANADA ───────────────────────────────────────────
    {"nationality":"IN","destination":"CA","purpose":"student",
     "requirement_text":"Indian nationals need a Study Permit for Canada. DLI acceptance letter required, proof of funds (CAD 20,635/year + tuition), valid passport. Student Direct Stream (SDS) for Indian applicants with IELTS 6.0+ in each band, GIC of CAD 20,635, and first year tuition paid — faster processing (20 days).",
     "documents_needed":"Valid passport, DLI acceptance letter, proof of funds (GIC or bank statements), passport photos, biometrics, medical exam (if required), IELTS certificate, tuition receipt (SDS)",
     "fee_usd":150,"processing_days":60,
     "source_url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html","source_name":"IRCC Canada",
     "last_updated":"2026-03-15","language":"en"},

    {"nationality":"IN","destination":"CA","purpose":"work",
     "requirement_text":"Indian nationals can work in Canada through TFWP (requires LMIA) or IMP. Express Entry manages permanent residence through Federal Skilled Worker, Federal Skilled Trades, and CEC. India is top source country for Express Entry. Minimum CRS score varies by draw (typically 480-520 in 2026).",
     "documents_needed":"Valid passport, LMIA (if applicable), job offer letter, work permit application, WES credential assessment, IELTS General Training, police clearance, medical exam, proof of funds",
     "fee_usd":155,"processing_days":90,
     "source_url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html","source_name":"IRCC Canada",
     "last_updated":"2026-04-01","language":"en"},

    {"nationality":"IN","destination":"CA","purpose":"tourist",
     "requirement_text":"Indian nationals need Temporary Resident Visa (TRV) for Canada tourism. Processing from India takes 30-45 days. Strong travel history (US/UK/Schengen visas) improves approval. Biometric requirements apply.",
     "documents_needed":"Valid passport, application form, visa fee, photos, bank statements (6 months), employment letter, income tax returns, travel itinerary, hotel bookings, invitation letter, previous visa copies",
     "fee_usd":100,"processing_days":40,
     "source_url":"https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html","source_name":"IRCC Canada",
     "last_updated":"2026-05-01","language":"en"},

    # ── INDIA -> US ───────────────────────────────────────────────
    {"nationality":"IN","destination":"US","purpose":"student",
     "requirement_text":"Indian nationals need F-1 Student Visa. India is second-largest source of US international students. Apply at US Embassy New Delhi or Consulates in Mumbai, Chennai, Hyderabad, Kolkata. Must prove nonimmigrant intent, funding for entire program.",
     "documents_needed":"Valid passport (6+ months), Form I-20, SEVIS receipt, DS-160, visa fee ($185), financial documents, academic transcripts, GRE/GMAT/TOEFL scores, statement of purpose, resume",
     "fee_usd":185,"processing_days":30,
     "source_url":"https://in.usembassy.gov/visas/student-visas/","source_name":"US Embassy India",
     "last_updated":"2026-05-15","language":"en"},

    {"nationality":"IN","destination":"US","purpose":"work",
     "requirement_text":"H-1B is primary work visa for Indian nationals. India receives majority of H-1B approvals. Annual lottery registration (March) $215. EB-2/EB-3 green card backlog for India exceeds 100 years. L-1 intracompany transfer common for Indian tech workers.",
     "documents_needed":"Valid passport, approved I-129 petition, DS-160, visa fee ($205), degree certificates, experience letters, pay stubs, employer letter, client letters (consulting)",
     "fee_usd":205,"processing_days":60,
     "source_url":"https://in.usembassy.gov/visas/work-visas/","source_name":"US Embassy India",
     "last_updated":"2026-04-01","language":"en"},

    {"nationality":"IN","destination":"US","purpose":"tourist",
     "requirement_text":"Indian nationals need B-1/B-2 visitor visa. High application volume at Indian consulates. Drop-box (interview waiver) available for prior US visa holders. Must demonstrate ties to India, sufficient funds, travel purpose.",
     "documents_needed":"Valid passport, DS-160, visa fee ($185), photos, bank statements, employment letter, ITR, travel itinerary, hotel bookings, invitation letter",
     "fee_usd":185,"processing_days":14,
     "source_url":"https://in.usembassy.gov/visas/visitor-visas/","source_name":"US Embassy India",
     "last_updated":"2026-05-01","language":"en"},
]

result = bulk_index("visa-policies", policies)
print(f"Indexed {len(policies)} visa policy documents, errors={result.get('errors', False)}")

import time
time.sleep(2)
for purpose in ["student", "work", "family", "tourist"]:
    r = es.count(index="visa-policies", body={"query": {"term": {"purpose": purpose}}})
    print(f"  {purpose}: {r['count']} docs")
