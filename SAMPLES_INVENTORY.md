# Benjy Bookkeeping — Inwentaryzacja sampli (analiza 2026-06-06)

Folder: `benjy-bookkeeping/samples/`. Wszystkie PDF text-based (zero OCR — potwierdzone pdftotext).

## Źródła do parsowania (MVP) — REALNE dane Apr + May 2026

| Źródło | Plik(i) | Format | Ocena parsera |
|---|---|---|---|
| **AmEx** | `AMEX April Statement.pdf` (10 str), `Amex May Statement.pdf` | text PDF | TRUDNY. 3 cardholdery w 1 pliku (7-02009 Kaela, 7-01019 Kaela fuel, 7-02025 Benjy). Sekcje Payments/New Charges/Detail per karta. Multi-line merchant (np. "AplPay AT HOME STORE" + telefon w 2 linii). `-layout` pomaga ale kwoty czasem w osobnej linii. |
| **BoA Checking** | `BOA April Statement (checking).pdf` (12 str), `BOA 1_2026-05-29.pdf` | text PDF | TRUDNY. Apr: 73 deposits + 39 withdrawals. Problem: `-layout` rozjeżdża kwoty do osobnych linii od opisu; opisy wieloliniowe (DES:/ID:/INDN: na 2 linie). Sekcje: Deposits and other credits / Withdrawals / Checks / Service fees. Wzorce: "CLEARENT LLC DES:Deposits"→Hana, "MIMOSA COLLECTIV DES:[Name]"→HoneyBook, "Shopify DES:TRANSFER"→Shopify, "BKOFAMERICA ATM...NESCONSET"→Hana. |
| **BankAmericard** | `BOA Credit Card.pdf` | text PDF | ŁATWY. Niski wolumen (Apr: $438.86 charges, ~10-30 tx). New Balance $10,316.79. Holder BAPTISTE BENJY. |
| **Hana POS** | `Hana April Report.xlsx`, `May 2026 Hana Report.pdf` | XLSX (Apr) + PDF (May!) | ŚREDNI. UWAGA: kwiecień XLSX, maj PDF — DWA formaty tego samego źródła! XLSX = "Daily Posting Summary" agregowany. Kolumny: Sales Details / Canceled / Updated / New Sales / Grand Total. Net Taxable $48,032, Net Non-Taxable $6,407.28. |
| **HoneyBook Payments** | `Honeybook April Payments.csv` (22 wiersze), `Honeybook May-2026-Payments-report-.csv` | CSV | ŁATWY. Czyste, 42 kolumny. Per-payment, "1 of 3 payments / Retainer". NET_AMOUNT, TOTAL_AMOUNT, CLIENT_INFO. |
| **HoneyBook Booked** | `Honeybook April-2026-Booked Client-report.csv`, May wersja | CSV | ŁATWY. Nowe bookingi: Total Booked Value, Project Date, Tax. |
| **Shopify** | (API — brak pliku) | REST/MCP | osobny flow, token in progress |

## NIE są źródłami do parsowania (output / referencja)

| Plik | Co to | Znaczenie |
|---|---|---|
| `Towers Flowers - [Jan-Apr] 2026.pdf` | **Management Reporty od KEPT LLC** (zewn. księgowa) | P&L, Balance Sheet, Cash Flow, A/R, A/P. KLUCZOWE: Benjy MA już księgową robiącą reconciliation+raporty. Agent NIE zastępuje tego — dostarcza skategoryzowane tx do QBO. To są też wzorce nazw kont QBO! |
| `2023-12-15.pdf`, `eStmt_2023-*.pdf` | Stare wyciągi 2023 (przejęcie firmy) | Za stare/za małe do testów. Pomijamy. |
| `Perri_Farms_ April Statement.pdf`, `Perri May Statement.pdf` | Perri Farms (główny dostawca kwiatów) | Accrued COGS. Apr balance $13,221.16. Out of core brief, ale łatwy. |
| `Van Statement.pdf`, `Vehicle Finance*.pdf`, `Vehcile Finance 2.pdf` | North Mill (van) + Mazda | Out of scope Phase 2. 1 tx/mc. |
| `Seller Note Amortization.xlsx` | Harmonogram seller note | Już w rulebooku. Referencja. |

## Wzorce nazw kont QBO (z Kept LLC P&L — do mapowania kategoryzacji!)
Income: Shopify Sales/Returns/Shipping, Hana Sales/Discounts/Shipping, Honeybook Sales, Retail Sales.
COGS: Cost of goods sold. Expenses: Bank Fees, Hana Wire Fee, Honeybook Fees, Shopify Fees, Commissions & fees, Contract labor, Insurance, Interest paid, Accounting fees, Meals, Office supplies, Rent, Small tools & equipment, Software & apps, Utilities (Electricity/Internet & TV/Janitorial), Payroll (Fees/Taxes/Salaries & wages), Taxis or shared rides.

## Kluczowe wnioski dla budowy
1. **Format drift**: Hana raz XLSX raz PDF — parser musi obsłużyć oba (lub poprosić o spójny format).
2. **PDF -layout problem**: kwoty BoA odrywają się od opisu — parser nie może zakładać "kwota na końcu linii opisu". Trzeba parsować przez pozycje/koordynaty (pdfplumber words+bbox) zamiast czystego tekstu liniowego.
3. **AmEx 3 karty**: parser musi segmentować per cardholder.
4. **Kept LLC P&L = darmowy ground truth**: można walidować sumy kategoryzacji agenta względem realnych raportów księgowej.
