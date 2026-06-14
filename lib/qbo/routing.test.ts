import { describe, it, expect } from "vitest";
import type { QboAccount } from "./accounts";
import {
  categoryNormalSide,
  resolveCategoryAccount,
  resolveBankAccount,
  isReversal,
} from "./routing";

/** Build a fake QBO account and a name->account map keyed like accountMap(). */
function mk(name: string, type: string): QboAccount {
  return { Id: name.toLowerCase().replace(/\s+/g, "_"), Name: name, AccountType: type };
}
function mapOf(...accounts: QboAccount[]): Map<string, QboAccount> {
  const m = new Map<string, QboAccount>();
  for (const a of accounts) m.set(a.Name.toLowerCase().trim(), a);
  return m;
}

// A realistic slice of Benjy's chart of accounts (real names + types).
const ACCOUNTS = mapOf(
  mk("Checking - 2300", "Bank"),
  mk("AMEX 7-01001", "Credit Card"),
  mk("BankAmericard Platinum Plus Mastercard - 2797 - 1", "Credit Card"),
  mk("Utilities", "Expense"),
  mk("Vehicle expenses", "Other Expense"),
  mk("Cost of goods sold", "Cost of Goods Sold"),
  mk("Hana Sales", "Income"),
  mk("Shopify Sales", "Income"),
  mk("Honeybook Sales", "Income"),
  mk("Sales Tax Payable", "Other Current Liabilities"),
  mk("Partner Equity", "Equity"),
  // channel clearing accounts (bank side for channel sales)
  mk("Hana Bank", "Other Assets"),
  mk("Shopify Bank", "Other Current Assets"),
  mk("Honeybook Bank", "Other Assets"),
  // alias targets
  mk("Software & apps", "Expense"),
  mk("Meals", "Expense"),
  mk("Janitorial Service", "Expense"),
  mk("New York State Tax Payable", "Other Current Liabilities"),
  mk("Uncategorized Expense", "Expense"),
);

describe("categoryNormalSide — debit/credit side from AccountType", () => {
  it("Income types credit the category line", () => {
    expect(categoryNormalSide("Income")).toBe("Credit");
    expect(categoryNormalSide("Other Income")).toBe("Credit");
  });
  it("Expense / COGS types debit the category line", () => {
    expect(categoryNormalSide("Expense")).toBe("Debit");
    expect(categoryNormalSide("Other Expense")).toBe("Debit");
    expect(categoryNormalSide("Cost of Goods Sold")).toBe("Debit");
  });
  it("Liability types credit the category line", () => {
    expect(categoryNormalSide("Other Current Liabilities")).toBe("Credit");
    expect(categoryNormalSide("Long Term Liabilities")).toBe("Credit");
  });
  it("Equity debits the category line", () => {
    expect(categoryNormalSide("Equity")).toBe("Debit");
  });
  it("returns null for types where direction is undefined", () => {
    expect(categoryNormalSide("Bank")).toBeNull();
    expect(categoryNormalSide("Accounts Receivable")).toBeNull();
    expect(categoryNormalSide("")).toBeNull();
  });
});

describe("resolveCategoryAccount", () => {
  it("matches an exact account name (case-insensitive)", () => {
    const r = resolveCategoryAccount("Utilities", ACCOUNTS);
    expect(r).toEqual({ ok: true, account: ACCOUNTS.get("utilities") });
  });

  it("resolves safe aliases to the client's actual account", () => {
    const cases: [string, string][] = [
      ["Software subscriptions", "Software & apps"],
      ["Meals & Entertainment", "Meals"],
      ["Janitorial", "Janitorial Service"],
      ["State Taxes", "Sales Tax Payable"],
      ["Uncategorized", "Uncategorized Expense"],
    ];
    for (const [category, target] of cases) {
      const r = resolveCategoryAccount(category, ACCOUNTS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.account.Name).toBe(target);
    }
  });

  it("maps owner draws to the Partner Equity account", () => {
    for (const category of ["Owner draw", "Owner draw — Kaela"]) {
      const r = resolveCategoryAccount(category, ACCOUNTS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.account.Name).toBe("Partner Equity");
    }
  });

  it("still fails LOUDLY with owner_decision for loan payments (need principal/interest split)", () => {
    for (const category of ["Equipment Loan Payment", "Seller Note Split"]) {
      const r = resolveCategoryAccount(category, ACCOUNTS);
      expect(r).toEqual({ ok: false, reason: "owner_decision", category });
    }
  });

  it("fails with no_account for an unknown category", () => {
    const r = resolveCategoryAccount("Totally Made Up Category", ACCOUNTS);
    expect(r).toEqual({
      ok: false,
      reason: "no_account",
      category: "Totally Made Up Category",
    });
  });
});

describe("resolveBankAccount — source -> bank/card account", () => {
  it("routes known sources to the right account (kills the hardcoded 'checking' bug)", () => {
    expect(resolveBankAccount("amex", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("amex 7-01001"),
    });
    expect(resolveBankAccount("boa_checking", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("checking - 2300"),
    });
    expect(resolveBankAccount("boa_credit", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get(
        "bankamericard platinum plus mastercard - 2797 - 1",
      ),
    });
  });

  it("routes channel sources to their clearing accounts", () => {
    expect(resolveBankAccount("shopify", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("shopify bank"),
    });
    expect(resolveBankAccount("hana", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("hana bank"),
    });
    expect(resolveBankAccount("honeybook", ACCOUNTS)).toEqual({
      ok: true,
      account: ACCOUNTS.get("honeybook bank"),
    });
  });

  it("fails with no_account when the mapped account is missing from QBO", () => {
    const sparse = mapOf(mk("Utilities", "Expense")); // no bank/card accounts
    const r = resolveBankAccount("amex", sparse);
    expect(r).toEqual({
      ok: false,
      reason: "no_account",
      accountName: "AMEX 7-01001",
    });
  });
});

describe("isReversal — normalizes per-source sign conventions", () => {
  // Cards (amex, boa_credit) record a CHARGE as positive and a refund/credit as
  // negative. So a negative card amount IS a reversal of the normal direction.
  it("treats a negative card amount as a reversal (refund)", () => {
    expect(isReversal("amex", -21.75)).toBe(true);
    expect(isReversal("boa_credit", -50)).toBe(true);
  });
  it("treats a positive card amount as a normal charge (not a reversal)", () => {
    expect(isReversal("amex", 58.49)).toBe(false);
    expect(isReversal("boa_credit", 100)).toBe(false);
  });

  // boa_checking records deposits positive and withdrawals negative — the sign
  // is the CASH-FLOW direction, NOT a refund. A negative withdrawal is a normal
  // expense, a positive deposit is normal income. Direction comes from the
  // category account type, so a checking transaction is never itself a reversal.
  it("never treats a checking transaction as a reversal (sign = cash flow)", () => {
    expect(isReversal("boa_checking", -184.76)).toBe(false); // normal expense
    expect(isReversal("boa_checking", 2201.08)).toBe(false); // normal deposit
    expect(isReversal("boa_checking", -8000)).toBe(false); // normal owner draw
  });

  // Channels record a sale as positive; a negative would be a return/refund.
  it("treats a negative channel amount as a return (reversal)", () => {
    expect(isReversal("shopify", -82.59)).toBe(true);
    expect(isReversal("hana", 103335)).toBe(false);
    expect(isReversal("honeybook", 2164.49)).toBe(false);
  });
});
