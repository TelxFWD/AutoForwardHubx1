import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  config: RequestInit = {}
): Promise<any> {
  // Ensure Content-Type is set for requests with body
  const headers: Record<string, string> = {
    ...config.headers,
  };

  // Add Content-Type for requests with body
  if (config.body && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  console.log("=== API REQUEST ===");
  console.log("URL:", url);
  console.log("Method:", config.method || "GET");
  console.log("Headers:", headers);
  console.log("Body:", config.body);

  const response = await fetch(url, {
    ...config,
    headers,
  });

  console.log("Response status:", response.status);
  console.log("Response headers:", Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));

    console.error("API request failed:", error);
    throw new Error(error.message || "Request failed");
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    const responseData = await response.json();
    console.log("Response data:", responseData);
    return responseData;
  }

  const responseText = await response.text();
  console.log("Response text:", responseText);
  return responseText;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: 30000, // Refresh every 30 seconds for live data
      refetchOnWindowFocus: true,
      staleTime: 5000, // Data is fresh for 5 seconds
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});