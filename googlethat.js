export function buildUrl({ query, tbs, hl = "en", gl = "us", page = 1 }) {
  if (!query) throw new Error("Query is required");

  const params = new URLSearchParams();

  params.append("q", query.trim());
  params.append("hl", hl);
  params.append("gl", gl);

  if (tbs) params.append("tbs", tbs);
  if (page > 1) params.append("start", (page - 1) * 10);

  return `https://www.google.com/search?${params.toString()}`;
}
