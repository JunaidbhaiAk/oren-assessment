# Plant data, from entry to approval: write-up

## What I built

A plant sends a month, a reviewer approves it, Meera sees only approved figures.

- **Send a month** (data owner). On the Plants page, a plant the user reports for has an **Enter months** button. It opens a year grid with one status per month: not started, draft, in review, approved, sent back. Clicking a month opens a form with the six items and a unit choice for each (kWh or MWh, litres or kilolitres, tonnes). It can be saved as a draft and finished later, then submitted. A month in review or approved is read-only.
- **Fix and resubmit.** A sent-back month shows the reviewer's comment. The owner corrects it and resubmits.
- **Review.** The queue puts months with big changes first. Opening one shows each item's change against the plant's last approved month and its CO2, with Scope 1 and 2 totals. The reviewer approves, or sends back with a required comment.
- **Dashboard** (Meera). Every plant by every month with its status, approved CO2 by plant and for the company with Scope 1 and 2 apart, and a line saying how many months that have ended are approved yet.
- **Audit log** (Meera and reviewers). Every create, save, submit, approval and send-back with who, when and the before and after values. Each approved month on the dashboard links to its own history.

## Decisions, and why

- **Approved only, enforced on the server.** The dashboard query attaches CO2 only to approved months. A draft or in-review number cannot reach the page, so Meera cannot show the board an unapproved figure by mistake.
- **Quantities are stored as entered, with their unit.** Plants send kWh, MWh, kL and tonnes. Converting at entry would lose what the plant actually typed, and an auditor will ask. CO2 is computed from the stored value and the factor table.
- **One change log for everything.** I reused the starter's `ChangeLog` instead of a second audit table. Each approved figure traces back to who entered what, who submitted and who approved.
- **Reviewers see where to look.** An item is flagged when it moves more than 30% against the last approved month, or becomes non-zero from zero. Units are converted first, so MWh against kWh compares correctly. The 30% is my guess and is one constant.
- **A reviewer cannot review a plant they report for.** Priya Nair is both. The server blocks it.
- **Double decisions are refused.** If two reviewers act on one month, the second gets a conflict, not a silent overwrite.
- **A month can be reported only after it ends.** Every item is required to submit, but zero is allowed. Clinker is optional at grinding units, because they make none (Paradip's sample says N/A).
- **Entry sits under the plant**, not in the sidebar, so an owner with several plants always knows which one they are entering for.

## Assumptions

Calendar year, not April to March. A plant has one report per month. Approved months are final. Totals are tonnes of CO2, using the factor table as given.

## What I left out

- Reopening an approved month. A correction after approval needs a controlled reopen with its own audit entries.
- Financial-year view, plant-by-plant comparison charts, and exports (CSV or PDF) for the auditor.
- Uploading the plants' spreadsheets. Entry is by form, which takes minutes for six numbers.
- Notifications. Nobody is told when a month is submitted or sent back.
- Real sign-in. The user switcher stays, as asked.

## What I would build next

1. A reopen flow for approved months, with a mandatory reason.
2. Email or in-app notices on submit and send-back.
3. Spreadsheet import with unit checks, to replace today's emailed files.
4. CSV and PDF export of an approved figure with its full history.
5. Per-plant thresholds for flagging, instead of one 30% rule.

## How I used AI

I used Claude Code (Sonnet) in the terminal for most of the build: reading the starter, drafting the schema, services, routers and pages, and writing tests. I decided the product rules (what blocks a submit, who may review what, what the dashboard may show), the layout of the screens, and which of its suggestions to take. Each step ran `typecheck`, the tests and the production build before it was committed.

**One place the AI was wrong.** *(Edit this to your own words before sending.)* On the first version of month entry, it added a plant dropdown that silently defaulted to the user's first plant. With one plant per owner in the sample data it looked fine, and I caught it in review: a real owner with several plants would not know which plant they were entering for. We moved entry to a button on each plant's row. The same change showed the Plants list was filtering to the user's own plants for every role, which would have shown Meera an empty list, so that is fixed too.
