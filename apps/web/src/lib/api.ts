const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("avenza_token");
}

export function setToken(token: string) {
  localStorage.setItem("avenza_token", token);
}

export function clearToken() {
  localStorage.removeItem("avenza_token");
  localStorage.removeItem("avenza_org");
}

export function getOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("avenza_org");
}

export function setOrgId(id: string) {
  localStorage.setItem("avenza_org", id);
}

export async function api<T>(
  path: string,
  options: RequestInit & { orgId?: string } = {},
): Promise<T> {
  const { orgId: orgOption, headers: initHeaders, body, ...rest } = options;
  const headers = new Headers(initHeaders || {});
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (isForm) {
    // Let the browser set multipart boundary — never force JSON here.
    headers.delete("Content-Type");
  } else if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const orgId = orgOption || getOrgId();
  if (orgId) headers.set("x-organization-id", orgId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, body, headers });
  } catch (err) {
    const hint =
      API_URL.includes("localhost")
        ? "API URL points at localhost — set NEXT_PUBLIC_API_URL on Vercel to your Render API."
        : "Network/CORS error — on Render set APP_URL and CORS_ORIGINS to your Vercel domain, then redeploy the API.";
    throw new Error(`${(err as Error).message || "Failed to fetch"}. ${hint}`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = data.message ?? data.error ?? res.statusText ?? "Request failed";
    let text: string;
    if (Array.isArray(msg)) text = msg.join(", ");
    else if (msg && typeof msg === "object") {
      const flat = msg as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const fields = flat.fieldErrors
        ? Object.entries(flat.fieldErrors)
            .flatMap(([k, v]) => (v || []).map((e) => `${k}: ${e}`))
            .join("; ")
        : "";
      text = [flat.formErrors?.join(", "), fields].filter(Boolean).join(" · ") || JSON.stringify(msg);
    } else text = String(msg);
    throw new Error(text);
  }
  return data as T;
}
