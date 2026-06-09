export interface CityInfo {
  name: string;
  monthlyCost: string;
  diaspora: Record<string, string>;
}

export interface SchoolInfo {
  name: string;
  annualTuition: string;
}

export interface MajorInfo {
  name: string;
  avgSalary: string;
}

export interface VisaType {
  name: string;
  code: string;
  type: 'immigrant' | 'non-immigrant';
}

export interface DestinationInfo {
  region: string;
  visaTypes: VisaType[];
  prTimeline: string;
  economy: string;
  workOpportunities: string;
  topCities: CityInfo[];
  topSchools: SchoolInfo[];
  topMajors: MajorInfo[];
  scams: string[];
  realTalk: string;
}

export const DEST_DATA: Record<string, DestinationInfo> = {
  US: {
    region: 'NORTH AMERICA',
    visaTypes: [
      { name: 'B1/B2 Tourist', code: 'B1/B2', type: 'non-immigrant' },
      { name: 'F-1 Student', code: 'F-1', type: 'non-immigrant' },
      { name: 'H-1B Work', code: 'H-1B', type: 'non-immigrant' },
      { name: 'DV Lottery', code: 'DV', type: 'immigrant' },
    ],
    prTimeline: '5-15 years (employment-based) or DV Lottery',
    economy: '$76,000 median household income · 3.9% unemployment',
    workOpportunities: 'Tech, healthcare, finance, engineering. OPT for F-1 students. H-1B lottery system.',
    topCities: [
      { name: 'Houston, TX', monthlyCost: '$1,800', diaspora: { ET: '15,000', NG: '40,000', IN: '90,000', KE: '8,000' } },
      { name: 'Washington DC', monthlyCost: '$2,400', diaspora: { ET: '250,000', NG: '20,000', EG: '12,000', KE: '10,000' } },
      { name: 'New York, NY', monthlyCost: '$3,200', diaspora: { NG: '60,000', GH: '25,000', EG: '30,000', BD: '75,000' } },
      { name: 'Minneapolis, MN', monthlyCost: '$1,500', diaspora: { ET: '40,000', KE: '15,000', NP: '8,000' } },
      { name: 'Dallas, TX', monthlyCost: '$1,700', diaspora: { ET: '20,000', NG: '35,000', IN: '80,000' } },
    ],
    topSchools: [
      { name: 'CUNY System (NY)', annualTuition: '$7,500' },
      { name: 'UT Arlington', annualTuition: '$11,000' },
      { name: 'U of Minnesota Duluth', annualTuition: '$14,000' },
      { name: 'San Jose State', annualTuition: '$8,000' },
      { name: 'Georgia State', annualTuition: '$12,000' },
    ],
    topMajors: [
      { name: 'Computer Science', avgSalary: '$105,000' },
      { name: 'Nursing (BSN)', avgSalary: '$82,000' },
      { name: 'Electrical Engineering', avgSalary: '$95,000' },
      { name: 'Accounting / CPA', avgSalary: '$72,000' },
      { name: 'Data Science', avgSalary: '$98,000' },
    ],
    scams: [
      'Agents promising "guaranteed" visa for $5,000+',
      'Fake DV Lottery winner emails / SMS',
      'Sponsorship letters sold for $2k that cause 221(g) refusals',
      '"Embassy connect" brokers who take money and disappear',
    ],
    realTalk: 'Apply yourself on travel.state.gov. No legit agent can guarantee a US visa. Strong ties to home + honest DS-160 beats any "connect".',
  },
  GB: {
    region: 'EUROPE',
    visaTypes: [
      { name: 'Standard Visitor', code: 'Visit', type: 'non-immigrant' },
      { name: 'Student Visa', code: 'Tier 4', type: 'non-immigrant' },
      { name: 'Skilled Worker', code: 'Tier 2', type: 'non-immigrant' },
      { name: 'Family Visa', code: 'Family', type: 'immigrant' },
    ],
    prTimeline: '5 years on qualifying visa → ILR → citizenship at 6 years',
    economy: '£34,000 median salary · 4.0% unemployment',
    workOpportunities: 'NHS healthcare, finance (City of London), tech, engineering. Graduate visa (2yr post-study).',
    topCities: [
      { name: 'London', monthlyCost: '£2,200', diaspora: { NG: '120,000', GH: '95,000', IN: '550,000', BD: '300,000', KE: '60,000' } },
      { name: 'Manchester', monthlyCost: '£1,200', diaspora: { NG: '15,000', PK: '80,000', BD: '30,000' } },
      { name: 'Birmingham', monthlyCost: '£1,100', diaspora: { PK: '150,000', IN: '60,000', BD: '35,000' } },
      { name: 'Leeds', monthlyCost: '£1,000', diaspora: { PK: '25,000', IN: '15,000' } },
      { name: 'Edinburgh', monthlyCost: '£1,300', diaspora: { IN: '12,000', NG: '5,000' } },
    ],
    topSchools: [
      { name: 'University of Bolton', annualTuition: '£12,000' },
      { name: 'Staffordshire University', annualTuition: '£13,500' },
      { name: 'University of Bedfordshire', annualTuition: '£13,000' },
      { name: 'Coventry University', annualTuition: '£15,000' },
      { name: 'University of Sunderland', annualTuition: '£12,500' },
    ],
    topMajors: [
      { name: 'Nursing / NHS roles', avgSalary: '£35,000' },
      { name: 'Software Engineering', avgSalary: '£55,000' },
      { name: 'Finance / Accounting', avgSalary: '£45,000' },
      { name: 'Civil Engineering', avgSalary: '£42,000' },
      { name: 'Pharmacy', avgSalary: '£40,000' },
    ],
    scams: [
      'Fake CAS letters for student visas sold online',
      'Agents claiming "Home Office contacts" for fast-tracking',
      'Bogus English language test certificates',
      'Fake job offers with fabricated sponsorship licenses',
    ],
    realTalk: 'Apply through gov.uk. Real sponsors are on the public register. Anyone selling a CAS letter or "guaranteed sponsorship" is running a scam.',
  },
  CA: {
    region: 'NORTH AMERICA',
    visaTypes: [
      { name: 'Visitor Visa', code: 'TRV', type: 'non-immigrant' },
      { name: 'Study Permit', code: 'Study', type: 'non-immigrant' },
      { name: 'Express Entry', code: 'EE', type: 'immigrant' },
      { name: 'PGWP', code: 'PGWP', type: 'non-immigrant' },
    ],
    prTimeline: '1-3 years via Express Entry (CRS score dependent)',
    economy: 'C$60,000 median household income · 5.4% unemployment',
    workOpportunities: 'Tech (Toronto/Vancouver), oil & gas (Alberta), healthcare. PGWP after graduation.',
    topCities: [
      { name: 'Toronto, ON', monthlyCost: 'C$2,400', diaspora: { ET: '30,000', NG: '25,000', IN: '700,000', PH: '250,000' } },
      { name: 'Calgary, AB', monthlyCost: 'C$1,700', diaspora: { ET: '20,000', NG: '10,000', IN: '80,000', PH: '70,000' } },
      { name: 'Edmonton, AB', monthlyCost: 'C$1,500', diaspora: { ET: '15,000', NG: '8,000', PH: '60,000' } },
      { name: 'Vancouver, BC', monthlyCost: 'C$2,600', diaspora: { IN: '350,000', PH: '150,000', KE: '5,000' } },
      { name: 'Winnipeg, MB', monthlyCost: 'C$1,300', diaspora: { ET: '8,000', PH: '50,000', IN: '30,000', NG: '5,000' } },
    ],
    topSchools: [
      { name: 'Conestoga College', annualTuition: 'C$16,000' },
      { name: 'Algonquin College', annualTuition: 'C$15,000' },
      { name: 'Memorial University', annualTuition: 'C$12,000' },
      { name: 'U of Manitoba', annualTuition: 'C$17,000' },
      { name: 'Thompson Rivers U', annualTuition: 'C$13,000' },
    ],
    topMajors: [
      { name: 'Computer Science', avgSalary: 'C$85,000' },
      { name: 'Nursing', avgSalary: 'C$75,000' },
      { name: 'Accounting / CPA', avgSalary: 'C$65,000' },
      { name: 'Mechanical Engineering', avgSalary: 'C$78,000' },
      { name: 'Business Analytics', avgSalary: 'C$72,000' },
    ],
    scams: [
      'Fake LMIA job offers sold for $10,000+',
      'Fraudulent DLI college acceptance letters',
      '"Guaranteed Express Entry points" services',
      'Ghost consultants not registered with CICC',
    ],
    realTalk: 'Check IRCC directly. Legitimate LMIA employers never charge applicants. Use the official Express Entry system. Only hire CICC-registered consultants.',
  },
  DE: {
    region: 'EUROPE',
    visaTypes: [
      { name: 'Schengen Tourist', code: 'Schengen', type: 'non-immigrant' },
      { name: 'Student Visa', code: 'Student', type: 'non-immigrant' },
      { name: 'EU Blue Card', code: 'Blue Card', type: 'non-immigrant' },
      { name: 'Family Reunion', code: 'Family', type: 'immigrant' },
    ],
    prTimeline: '21 months (Blue Card) or 5 years (standard)',
    economy: '€44,000 median salary · 3.2% unemployment',
    workOpportunities: 'Engineering, automotive, IT, manufacturing. Free/low-cost universities. 18-month job-seeker visa.',
    topCities: [
      { name: 'Berlin', monthlyCost: '€1,200', diaspora: { ET: '5,000', NG: '3,000', IN: '25,000', EG: '8,000' } },
      { name: 'Munich', monthlyCost: '€1,600', diaspora: { IN: '20,000', EG: '5,000' } },
      { name: 'Frankfurt', monthlyCost: '€1,400', diaspora: { ET: '8,000', NG: '4,000', IN: '15,000' } },
      { name: 'Hamburg', monthlyCost: '€1,200', diaspora: { GH: '12,000', IN: '8,000' } },
    ],
    topSchools: [
      { name: 'TU Munich (free)', annualTuition: '€150' },
      { name: 'LMU Munich (free)', annualTuition: '€150' },
      { name: 'RWTH Aachen (free)', annualTuition: '€300' },
      { name: 'TU Berlin (free)', annualTuition: '€310' },
      { name: 'U of Stuttgart (free)', annualTuition: '€1,500' },
    ],
    topMajors: [
      { name: 'Mechanical Engineering', avgSalary: '€55,000' },
      { name: 'Computer Science', avgSalary: '€60,000' },
      { name: 'Electrical Engineering', avgSalary: '€52,000' },
      { name: 'Business Informatics', avgSalary: '€50,000' },
      { name: 'Medicine', avgSalary: '€65,000' },
    ],
    scams: [
      'Fake blocked account (Sperrkonto) services stealing deposits',
      'Fraudulent university admission letters',
      'Bogus apartment "reservation fee" scams before arrival',
    ],
    realTalk: 'Germany has near-free tuition at public universities. You only need a blocked account (€11,208/yr). Apply directly — agents are rarely needed.',
  },
  AU: {
    region: 'OCEANIA',
    visaTypes: [
      { name: 'Visitor (ETA)', code: 'ETA', type: 'non-immigrant' },
      { name: 'Student Visa', code: '500', type: 'non-immigrant' },
      { name: 'Skilled Worker', code: '482', type: 'non-immigrant' },
      { name: 'Partner Visa', code: '820', type: 'immigrant' },
    ],
    prTimeline: '2-4 years via skilled migration (points-based)',
    economy: 'A$65,000 median salary · 3.7% unemployment',
    workOpportunities: 'Mining, healthcare, IT, construction. Post-study work visa (2-4 years). Skilled occupation list.',
    topCities: [
      { name: 'Melbourne, VIC', monthlyCost: 'A$2,000', diaspora: { IN: '200,000', PH: '40,000', NP: '30,000', BD: '20,000' } },
      { name: 'Sydney, NSW', monthlyCost: 'A$2,400', diaspora: { IN: '250,000', PH: '50,000', BD: '35,000', NP: '25,000' } },
      { name: 'Brisbane, QLD', monthlyCost: 'A$1,700', diaspora: { IN: '60,000', PH: '20,000', NP: '15,000' } },
      { name: 'Perth, WA', monthlyCost: 'A$1,600', diaspora: { IN: '50,000', PH: '15,000' } },
      { name: 'Adelaide, SA', monthlyCost: 'A$1,400', diaspora: { IN: '45,000', NP: '10,000', BD: '8,000' } },
    ],
    topSchools: [
      { name: 'Western Sydney U', annualTuition: 'A$26,000' },
      { name: 'University of Tasmania', annualTuition: 'A$28,000' },
      { name: 'Charles Sturt U', annualTuition: 'A$25,000' },
      { name: 'Griffith University', annualTuition: 'A$29,000' },
      { name: 'Deakin University', annualTuition: 'A$30,000' },
    ],
    topMajors: [
      { name: 'Nursing', avgSalary: 'A$75,000' },
      { name: 'IT / Cybersecurity', avgSalary: 'A$90,000' },
      { name: 'Civil Engineering', avgSalary: 'A$80,000' },
      { name: 'Accounting', avgSalary: 'A$65,000' },
      { name: 'Teaching', avgSalary: 'A$72,000' },
    ],
    scams: [
      'Fake education agent offers with non-CRICOS registered courses',
      '"Guaranteed PR" packages sold for A$10,000+',
      'Fake job sponsorship from non-approved employers',
    ],
    realTalk: 'Only study at CRICOS-registered institutions. Check the skilled occupation list before choosing a course. Use MARA-registered agents only.',
  },
  FR: {
    region: 'EUROPE',
    visaTypes: [
      { name: 'Schengen Tourist', code: 'Schengen', type: 'non-immigrant' },
      { name: 'Student Visa', code: 'Student', type: 'non-immigrant' },
      { name: 'Talent Passport', code: 'Talent', type: 'non-immigrant' },
      { name: 'Family Visa', code: 'Family', type: 'immigrant' },
    ],
    prTimeline: '5 years → carte de résident',
    economy: '€29,000 median salary · 7.3% unemployment',
    workOpportunities: 'Luxury goods, aerospace, tech (Station F), tourism. Low tuition at public universities.',
    topCities: [
      { name: 'Paris', monthlyCost: '€1,500', diaspora: { NG: '5,000', EG: '10,000' } },
      { name: 'Lyon', monthlyCost: '€900', diaspora: { ET: '2,000' } },
      { name: 'Marseille', monthlyCost: '€850', diaspora: { EG: '4,000' } },
    ],
    topSchools: [
      { name: 'Université Paris-Saclay', annualTuition: '€170' },
      { name: 'Université de Strasbourg', annualTuition: '€170' },
      { name: 'Université de Lyon', annualTuition: '€170' },
    ],
    topMajors: [
      { name: 'Engineering', avgSalary: '€42,000' },
      { name: 'Computer Science', avgSalary: '€45,000' },
      { name: 'Business / MBA', avgSalary: '€40,000' },
    ],
    scams: [
      'Fake Campus France interview coaching for €1,000+',
      'Fraudulent housing deposits for Paris apartments',
    ],
    realTalk: 'French public universities charge ~€170/year. Apply through Campus France. Learn basic French — it makes everything easier.',
  },
  NL: {
    region: 'EUROPE',
    visaTypes: [
      { name: 'Schengen Tourist', code: 'Schengen', type: 'non-immigrant' },
      { name: 'Study MVV', code: 'MVV', type: 'non-immigrant' },
      { name: 'Kennismigrant', code: 'HSM', type: 'non-immigrant' },
      { name: 'Family Visa', code: 'Family', type: 'immigrant' },
    ],
    prTimeline: '5 years → permanent residence',
    economy: '€38,000 median salary · 3.6% unemployment',
    workOpportunities: 'Tech (Amsterdam), agriculture, logistics, finance. 30% ruling tax benefit for skilled migrants.',
    topCities: [
      { name: 'Amsterdam', monthlyCost: '€1,800', diaspora: { GH: '10,000', IN: '15,000' } },
      { name: 'Rotterdam', monthlyCost: '€1,300', diaspora: { GH: '5,000' } },
      { name: 'The Hague', monthlyCost: '€1,200', diaspora: { ET: '3,000' } },
    ],
    topSchools: [
      { name: 'Saxion University', annualTuition: '€8,500' },
      { name: 'Hanze University', annualTuition: '€8,000' },
      { name: 'NHL Stenden', annualTuition: '€8,500' },
    ],
    topMajors: [
      { name: 'Computer Science', avgSalary: '€50,000' },
      { name: 'Business', avgSalary: '€42,000' },
      { name: 'Engineering', avgSalary: '€48,000' },
    ],
    scams: [
      'Fake MVV application services',
      'Fraudulent housing agencies in Amsterdam',
    ],
    realTalk: 'The Netherlands has excellent English-taught programs. Apply directly to universities — they handle your MVV. The 30% ruling is a huge tax benefit.',
  },
  SE: {
    region: 'EUROPE',
    visaTypes: [
      { name: 'Schengen Tourist', code: 'Schengen', type: 'non-immigrant' },
      { name: 'Student Residence', code: 'Study', type: 'non-immigrant' },
      { name: 'Work Permit', code: 'Work', type: 'non-immigrant' },
      { name: 'Family Visa', code: 'Family', type: 'immigrant' },
    ],
    prTimeline: '4 years → permanent residence',
    economy: 'SEK 35,000/mo median · 6.8% unemployment',
    workOpportunities: 'Tech (Stockholm), manufacturing, healthcare. Free tuition for EU, scholarship options for others.',
    topCities: [
      { name: 'Stockholm', monthlyCost: 'SEK 12,000', diaspora: { ET: '15,000', IN: '10,000' } },
      { name: 'Gothenburg', monthlyCost: 'SEK 9,000', diaspora: { IN: '5,000' } },
      { name: 'Malmö', monthlyCost: 'SEK 8,500', diaspora: { ET: '3,000' } },
    ],
    topSchools: [
      { name: 'Jönköping University', annualTuition: 'SEK 80,000' },
      { name: 'Linnaeus University', annualTuition: 'SEK 90,000' },
      { name: 'Mälardalen University', annualTuition: 'SEK 85,000' },
    ],
    topMajors: [
      { name: 'Software Engineering', avgSalary: 'SEK 45,000/mo' },
      { name: 'Nursing', avgSalary: 'SEK 35,000/mo' },
      { name: 'Mechanical Engineering', avgSalary: 'SEK 40,000/mo' },
    ],
    scams: [
      'Fake Swedish Migration Agency emails requesting payment',
      'Fraudulent housing deposits before arrival',
    ],
    realTalk: 'Apply through universityadmissions.se. Sweden offers generous scholarships (SI Scholarships). Learn some Swedish — it helps with jobs and integration.',
  },
};
