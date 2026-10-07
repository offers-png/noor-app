export const API = import.meta.env?.VITE_API_URL || "https://main-backend-k32m.onrender.com";

export async function api(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("The server could not complete this request. Please try again.");
    if (res.status === 204) return null;
    return await res.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The server is taking too long to respond. Please try again.");
    if (error instanceof TypeError) throw new Error("Unable to connect. Check your internet connection and try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
