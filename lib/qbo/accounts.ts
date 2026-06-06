import "server-only";
import { getValidAccessToken, apiBase } from "./oauth";

export interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
}

/** Fetch the chart of accounts from QBO. */
export async function fetchAccounts(): Promise<QboAccount[]> {
  const { token, realmId } = await getValidAccessToken();
  const query = encodeURIComponent("select Id, Name, AccountType from Account maxresults 1000");
  const res = await fetch(
    `${apiBase()}/v3/company/${realmId}/query?query=${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error(`QBO accounts fetch failed: ${res.status}`);
  const body = (await res.json()) as { QueryResponse?: { Account?: QboAccount[] } };
  return body.QueryResponse?.Account ?? [];
}

/**
 * Build a case-insensitive name→id map of QBO accounts.
 * Categorization category names should match QBO account names
 * (taken from the Kept LLC P&L during build).
 */
export async function accountMap(): Promise<Map<string, QboAccount>> {
  const accounts = await fetchAccounts();
  const map = new Map<string, QboAccount>();
  for (const a of accounts) {
    map.set(a.Name.toLowerCase().trim(), a);
  }
  return map;
}
