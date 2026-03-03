# SOVEREIGN HOUSE INTELLIGENCE — MODULE MAP
## Last updated: March 3, 2026

**Deploy folder:** Upload entire folder to Netlify (drag & drop all 12 files)

---

## FILE INVENTORY

| File | Lines | What's Inside |
|------|-------|---------------|
| `index.html` | 78 | HTML shell only — no JS, no CSS. Loads everything via `<link>` and `<script>` tags. |
| `styles.css` | 63 | All CSS — dark theme, cards, overlays, sheets, buttons, grids, animations, responsive |
| `sh-core.js` | 35 | Constants (Supabase URL, API key, webhook), utility functions ($, $k, sc, esc, truncSub, checkGuardGated, isPend, ring, tag, isGolf), known guard-gated list |
| `sh-dashboard.js` | 163 | State vars (props, watchIds, alerts, analysisMap, deals), loadData(), checkHealth(), renderDashboard(), setView(), togglePulse(), renderList(), search/sort listeners |
| `sh-deals.js` | 370 | DEAL_STAGES, dealBadge(), renderDeals(), openDeal(), closeDeal(), updateDealStatus(), killDeal(), logCounter(), addConcession(), removeConcession(), addDealNote(), saveDealField() |
| `sh-detail.js` | 126 | openDetail() — property detail modal with comps, price history, listing agent, notes, action buttons. closeDetail(), watchProp(), unwatchProp(), saveNote(), deleteNote(), renderNotes(), copyLisa() |
| `sh-ai.js` | 241 | aiUnderwrite() — webhook trigger + polling. renderAiResult() — Claude analysis display card. openCalcFromAi(), shareAiAnalysis() |
| `sh-calculator.js` | 434 | Full 8-Step Protocol Calculator — openCalc(), closeCalc(), renderCalc(), updateCalc(), toggleSec(), applyTier(), toggleCalcHist(), loadCalcHist(), doSaveCalc() |
| `sh-offer-calc.js` | 275 | saveAndOffer() — offer flow from calculator. exportPDF() — jsPDF generation. shareAnalysis() — text share |
| `sh-alerts.js` | 117 | markRead(), removeAlertRow(), updateAlertBadge(), updateAlertPageCount(), dismissOne(), dismissAndOpen(), dismissAllAlerts(), openAlerts(), closeAlerts(), initSwipe() |
| `sh-offer.js` | 352 | openOffer() — offer builder from detail view (with AI/calc data). updateOfferCalc(), generateOfferPackage() — deal save + email/summary generation |
| `sh-rpa-init.js` | 155 | openRPABuilder(), openRPAFromDeal() — GLVAR RPA prefill. checkMagicLink(). App init: loadData().then(checkMagicLink) |

---

## WHAT TO TELL CLAUDE

When starting a build session, say:

> "I need to work on [feature]. Read [filename] from the deploy folder."

Examples:
- **Calculator bug:** "Read sh-calculator.js"
- **AI underwrite display:** "Read sh-ai.js"
- **New dashboard filter:** "Read sh-dashboard.js"
- **Offer builder fix:** "Read sh-offer.js and sh-offer-calc.js"
- **Styling change:** "Read styles.css"
- **New alert type:** "Read sh-alerts.js"
- **Deal pipeline update:** "Read sh-deals.js"
- **Property detail change:** "Read sh-detail.js"

Claude only needs to read the specific file(s) for the task — not the whole codebase.

---

## DEPLOY TO NETLIFY

1. Download all 12 files into one folder
2. Go to Netlify → your site → Deploys
3. Drag the entire folder onto the deploy area
4. Hard refresh after deploy

**Important:** All 12 files must be in the same folder (not nested). Netlify serves them from the same directory.

---

## BUG FIX LOG (from this breakup)

- **Fixed:** `AK` → `KEY` in sh-alerts.js (markRead and dismissAllAlerts were using undefined `AK` variable — alerts were silently failing to mark as read in Supabase)
