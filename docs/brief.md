# Client brief (Company A — Brand X dealer, Lucknow)

## Client

Company A, Lucknow. Authorised dealer for one passenger car brand (called Brand X here) with 3 showrooms, 2 service workshops and a certified used-car yard. 340 staff, revenue ₹550–650 crore a year, about 6,000 new and 900 used cars sold a year.

## Today

The website is a basic template with an enquiry form. Leads from the site, car portals, social ads and walk-ins are tracked in Excel; billing runs in the brand's dealer management system (DMS). Test drives and service bookings are fixed by phone. Used-car stock is shared as WhatsApp photos.

## The problem

Assumptions: 4,500 online leads a month. 30% (1,350) are not called within 24 hours and convert at 2% instead of 6%: 1,350 × 4% = 54 cars lost a month × ₹25,000 dealer contribution = ₹13.5 lakh a month, ₹1.62 crore a year. Of 3,000 service calls a month, 20% (600) go unanswered and half of those owners (300) go elsewhere: 300 × ₹4,500 average bill × 30% margin = ₹4.05 lakh a month, ₹48.6 lakh a year. Total ₹2.11 crore a year.

## Users

Car buyers and owners (mostly mobile), sales consultants and the lead desk, and service advisors. The Dealer Principal signs the deal.

## The ask

Our website looks like every other dealer's and does nothing. I want buyers to browse new and used cars with real prices, see the on-road price and EMI, and book a test drive in a real slot without calling. Owners should book a service in a minute. Every enquiry should reach a named consultant within five minutes.

## Must have

    Model and variant pages: photos, specs, colours, ex-showroom and on-road price by city (road tax, insurance, accessories) from an admin price table
    Certified used-car listings with filters, photos, inspection report and price
    Test-drive booking by showroom and demo car, and service booking by workshop bay capacity
    EMI calculator and trade-in request form
    Lead inbox for web enquiries and portal CSV imports, auto-assigned by showroom and model, with a response timer and status
    Admin CMS for models, prices, offers, used stock, banners and user roles

## Core build

Software Engineering candidates must ship this slice end to end, in about 6 to 8 screens: model and used-car pages with on-road price, test-drive booking, lead inbox with auto-assignment, and admin for cars and prices. Roles: buyer and sales consultant. AI: buyer summary and first-reply draft. Hard part: on-road price breakup by city from admin tables. Mock payments, messages and outside systems, and seed from the sample data. The rest of MUST HAVE is optional depth.

## Out of scope

    Online payment of booking amounts
    DMS integration (a daily CSV export instead)
    Spare parts e-commerce

## Ai or automation

Leads are assigned and acknowledged automatically by WhatsApp or SMS template. AI summarises each buyer's needs, drafts a first reply, and suggests a price band for used cars from past sales of the same model, year and kilometres. When it is wrong: drafts are edited before sending and never quote discounts; the used-car manager sets every final price and is the only one who sees the suggestion; consultants can re-assign leads; on-road prices always come from the admin table.

## Constraints

On-road prices must show the breakup, a validity date and a note that prices may change. Used-car listings show year, owners and kilometres but mask the full registration number. Buyer data is personal data under the DPDP Act 2023: consent checkbox and opt-out. Hindi and English. Pages must load in under 2.5 seconds on 4G, and every model and used car needs its own indexable page for search.

## Design

The client values good, minimal design: clean layouts, white space, a restrained palette and clear type, with nothing on screen that lacks a purpose. Design counts as much as features. The site should feel like a premium showroom: large car photography, generous spacing, one accent colour, and a price and a clear next step on every car page.

## Budget and time

₹9 lakh, 8 weeks. Success: 90% of web leads called within 5 minutes; 400 online test-drive bookings a month within 6 months; unanswered service calls from 20% to under 5%.

## Sample data
Stock ID	Type	Model	Variant	Fuel	Year	Km	Price ₹	Status
NEW-H-02	New	Model H	ZX automatic	Petrol	2026	0	1245000 ex-showroom	Available
UC-1182	Used	Model C	VX	Diesel	2022	41200	845000	Available
UC-1190	Used	Model S	LX	Petrol	2021	58600	512000	Booked
