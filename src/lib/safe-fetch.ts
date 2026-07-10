// Safe fetch utility — handles empty responses, non-JSON errors, and HTTP errors gracefully
export async function safeFetchJson(url: string, fallback: any = null): Promise<any> {
  try {
    const r = await fetch(url)
    if (!r.ok) {
      console.warn(`Fetch failed: ${url} → HTTP ${r.status}`)
      return fallback
    }
    const text = await r.text()
    if (!text || text.trim() === '') {
      return fallback
    }
    return JSON.parse(text)
  } catch (e) {
    console.warn(`Fetch error: ${url}`, e)
    return fallback
  }
}
