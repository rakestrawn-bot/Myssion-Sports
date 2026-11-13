# League Management App: Product Spec

## 1. Vision and Goals

A web app for running athletic leagues across multiple sports. Built first for Nick's own league (City of Sunny Isles Beach Recreation, a Florida Youth Soccer Association league) as client number one, but designed from day one as a multi-tenant SaaS product that independent clubs, leagues, and program managers across states can sign up for and configure on their own.

The builder (Nick) has no coding background, so Claude Code should explain decisions plainly, build in small testable steps, and prefer managed services over custom infrastructure.

## 2. Multi-Tenancy

- Every record belongs to an Organization. Complete data separation between organizations.
- Each organization has its own admins, sports, venues, divisions, rules, teams, clubs, and rosters.
- Self-serve signup: a new league creates its workspace, then configures it through a first-run setup flow.
- Organizations are fully independent from one another. They do not share fields or data.
- Nick's league is Organization #1 and the proving ground for troubleshooting.

## 3. Access Levels (five tiers)

1. **Platform owner:** Nick, across all organizations.
2. **League staff:** full admin within their organization. Only staff enter game results.
3. **Club administrator:** sees and edits everything for all teams in their own club (rosters, schedules, standings, conflicts) from one dashboard. Cannot see other clubs' rosters or player data.
4. **Coach:** edits only their own team's roster.
5. **Public:** views schedules and standings only, including outside coaches and families.

## 4. First-Run Setup Order

1. Create the organization and admin account.
2. Venues, fields, and zone layouts (see section 5).
3. Sports, seasons, and divisions with their default settings (section 6).
4. Scheduling rules (section 7).
5. Clubs, teams, and rosters (section 8).

## 5. Venues, Fields, and Zones

- A venue has fields. Each field has its own available days and time windows.
- Fields can be split. The manager defines named layouts for a parent field, not hard-coded splits. Example for soccer: full size; two 7v7 fields; or one 7v7 plus two 4v4 fields.
- Model each parent field as physical zones. Each layout lists its child fields and which zones each child occupies. A 7v7 might claim two zones, a 4v4 one zone.
- Conflict rule: two bookings collide only if they claim the same zone at the same time. This handles any split without special-case code.
- Each child field can have its own availability windows, which may differ from the parent's.

## 6. Divisions and Defaults

- Teams are grouped primarily by age group into divisions (for example U8, U10, U12).
- Each division carries settings: game format (for example 9v9), game length, allowed field sizes, roster limits, and age eligibility.
- The app ships starter templates per sport (for example U12 soccer defaults to 11v11). When an organization is created, templates are copied into that organization as editable settings.
- The manager can override anything. Nick's example: his U12 and above divisions play 9v9 because his fields are 9v9, not the standard 11v11.
- Overrides can also be set at the team level and the individual game level for odd cases.
- Governing body field: each organization can record the association whose rules it follows (for example Florida Youth Soccer). Roster limits and age cutoffs are entered from that body's current guidelines. Do not assume any numbers; they are set per season by the organization.

## 7. Scheduling Engine

**Scheduling unit:** the division. Nick's soccer league has about 36 teams across six age groups, roughly four to eight teams per division, with a typical season of six games per team.

**Season setup:** start and end dates, games per team, and available days and time windows per field.

**Feasibility check up front:** given teams, slots, and season length, tell the manager whether a full round robin fits, and if not, how many games per team is possible.

**Matchup generation (step one):**

- Round robin is the goal.
- Maximize unique opponents first. Only after all unique matchups are used, fill remaining games with repeat opponents.
- Never schedule the same opponent in back-to-back games.
- If a division has more teams than games per team allows (for example eight teams, six games), each team skips some opponents, and the skipped opponents should vary so it is fair. If a division is small (for example four teams), repeats are fine and should be rotated evenly.

**Slot assignment (step two):**

- Assign matchups to actual field slots while scoring fairness, then swap games to improve the score.
- Fairness targets, each with an adjustable weight: home and away balance (each team within one game of even), time slot balance (no team stuck with all early or all prime-time slots), and spacing of repeat matchups.

**Constraints:** blackout dates; minimum rest gap between a team's games; no team in two places at once; no coach double-booked across teams; no field or zone double-booked.

**Rain-outs:** one action that flags affected games, frees their slots, and offers the next open slots.

**Manual selection:** in addition to auto-scheduling, clubs, coaches, or outside groups can later be allowed to select fields and slots themselves. The open design question is precedence, for example staff reserve league slots first and others pick from what remains, or others request and staff approve. Decide this before building that feature.

## 8. Clubs, Teams, and Rosters

- **Club:** an entity under the organization with its own administrator login. A club can have many teams, possibly in different divisions.
- **Team:** belongs to a division, a season, and optionally a club. Has a name, a coach, and a type (in-house or outside).
- **Player:** a record at the organization level so players carry across seasons. Fields: name, birth date (drives age eligibility), guardian contact. Keep data minimal.
- **Roster:** the link between a player and a team for a season.
- Players can be shared across a club's teams to make moves easy. Warn if the same player lands on two teams in the same division.
- Outside teams: decide how much they submit (full roster or just team name and coach). Open item.
- Club dashboard: one page listing all of the club's teams, with roster editing and a combined schedule view so shared coaches and fields are easy to spot.

## 9. Rule Severity System

Every rule has a severity set by the league manager: **off**, **warn**, or **hard block**. One mechanism covers roster limits, age eligibility, scheduling conflicts, and anything added later. Staff can override warnings. Build this mechanism once and reuse it everywhere.

## 10. Phasing

1. **Phase 1:** staff-only version with sample data (fake teams and fake kids' names). Venues and zones, divisions, scheduling engine, teams and rosters, results entry and standings.
2. **Phase 2:** after testing and city IT approval, add coach and club administrator logins, public schedule and standings pages, and multi-organization signup.
3. **Later:** manual field and slot selection by clubs and outside groups; app stores only if people ask.

## 11. Build Plan

- Claude Code builds it. Web app first.
- Managed hosting and database, such as Vercel and Supabase.
- Use row-level security or an equivalent so organizations can never see each other's data.

### Build decisions

Decisions made while building, newest first. The code lives in the Myssion-Sports GitHub repository.

| Date | Area | Decision |
| --- | --- | --- |
| Nov 13, 2026 | Sign-in | Email link sign-in (no passwords) for phase 1. Passwords can be added later on the same accounts, since accounts are tied to the email address. Before real users arrive, connect a proper email service so sign-in emails aren't limited to a few per hour. |
| Nov 8, 2026 | Live database | Supabase project "myssion-sports" created on the free plan and the core structure loaded. New database changes are applied by a script that loads only migrations the project hasn't had yet. Sample data only until section 12 is done. |
| Nov 8, 2026 | Website | Next.js with TypeScript, to be hosted on Vercel. |
| Nov 8, 2026 | Database | Supabase (Postgres). Every database change is a numbered migration file in the repository, tested on a local copy before it goes live. |
| Nov 8, 2026 | Data separation | Two layers. Every record carries its organization, and child records must point to a parent in the same organization, so the database rejects cross-organization links. Row-level security then limits each user to their own organization's rows. |
| Nov 8, 2026 | Fields and zones | Venue → field → zones. A layout (e.g. "Two 7v7") lists child fields, and each child field claims one or more zones of its own parent field. A child field cannot claim another field's zones. |
| Nov 8, 2026 | Conflicts | Two bookings conflict only when they share a zone and their times overlap. A game that starts exactly when another ends is not a conflict. |
| Nov 8, 2026 | Availability | Weekly windows are set on the parent field. A child field can have its own windows, which replace the parent's for that child field. |
| Nov 8, 2026 | Bookings | A booking (child field + start + end) is separate from a game. Games will point to a booking, so practices or rentals can use the same conflict check later. |
| Nov 8, 2026 | Phase 1 access | League staff have full access within their own organization. Coaches and club administrators can see their organization but nothing else until phase 2. The platform owner sees every organization. |

## 12. Privacy and Compliance

The app stores minors' information and will serve organizations in multiple states. Before real data goes in: confirm City of Sunny Isles Beach IT rules on hosting and kids' data, research child-privacy obligations (for example COPPA and state laws), and put a terms of service and privacy policy in place. Use fake data until then.

## 13. Open Items

- City IT rules on hosting and kids' data.
- Exact sports, venues, and scheduling rules for Nick's league.
- Precedence rules for manual slot selection by outside groups.
- What outside teams must submit for rosters.
- Current Florida Youth Soccer roster limits and age cutoffs, to enter from official guidelines.
