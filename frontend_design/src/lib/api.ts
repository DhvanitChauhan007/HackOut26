import { supabase } from "./supabase";

const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] || "/api";

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer \${session.access_token}`);
  }

  const response = await fetch(`\${API_BASE_URL}\${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = "API request failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // Ignore JSON parse error if response is not JSON
    }
    throw new Error(errorMessage);
  }
  
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

// User & Profile
export const getMyProfile = () => fetchWithAuth("/users/me");
export const createMyProfile = (data: any) => fetchWithAuth("/users/me", { method: "POST", body: JSON.stringify(data) });

// Listings
export const getListings = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return fetchWithAuth(`/listings?\${query}`);
};
export const getListing = (id: string) => fetchWithAuth(`/listings/\${id}`);
export const createListing = (data: any) => fetchWithAuth("/listings", { method: "POST", body: JSON.stringify(data) });
export const updateListing = (id: string, data: any) => fetchWithAuth(`/listings/\${id}`, { method: "PATCH", body: JSON.stringify(data) });

// Requests
export const requestListing = (id: string) => fetchWithAuth(`/listings/\${id}/requests`, { method: "POST" });
export const getListingRequests = (id: string) => fetchWithAuth(`/listings/\${id}/requests`);
export const updateRequest = (id: string, status: "accepted" | "declined") => fetchWithAuth(`/requests/\${id}`, { method: "PATCH", body: JSON.stringify({ status }) });

// Transactions
export const estimateTransaction = (id: string) => fetchWithAuth(`/transactions/\${id}/estimate`, { method: "POST" });
export const commitTransaction = (id: string) => fetchWithAuth(`/transactions/\${id}/commit`, { method: "POST" });

// Jobs (Logistics)
export const getJobs = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return fetchWithAuth(`/jobs?\${query}`);
};
export const claimJob = (id: string) => fetchWithAuth(`/jobs/\${id}/claim`, { method: "POST" });
export const deliverJob = (id: string) => fetchWithAuth(`/jobs/\${id}/deliver`, { method: "POST" });

// Notifications
export const getNotifications = () => fetchWithAuth("/notifications");
export const markNotificationRead = (id: string) => fetchWithAuth(`/notifications/\${id}/read`, { method: "PATCH" });

// Impact
export const getImpactSummary = () => fetchWithAuth("/impact/summary");

// Ratings
export const createRating = (transactionId: string, data: { ratee_id?: string, rating: number, comment?: string }) => 
  fetchWithAuth(`/transactions/\${transactionId}/ratings`, { method: "POST", body: JSON.stringify(data) });
export const getUserRatings = (userId: string) => fetchWithAuth(`/users/\${userId}/ratings`);

// Bulk Lots
export const getBulkLots = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return fetchWithAuth(`/bulk-lots?\${query}`);
};
export const getBulkLot = (id: string) => fetchWithAuth(`/bulk-lots/\${id}`);
export const purchaseBulkLot = (id: string) => fetchWithAuth(`/bulk-lots/\${id}/purchase`, { method: "POST" });
