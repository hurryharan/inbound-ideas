export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request to ${url} failed`);
  return res.json();
}

export async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request to ${url} failed`);
  return res.json();
}
