export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers:
        body === undefined
          ? {}
          : { "content-type": "application/json", "x-thread-request": "1" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") throw new Error("Request cancelled.");
    throw new Error(
      "Thread could not reach the local server. Check that it is running.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server did not return a usable reply.");
  }
  if (!response.ok)
    throw new APIError(
      result.error?.message || "This request could not be completed.",
      response.status,
    );
  return result;
}
export const stamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const timezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
