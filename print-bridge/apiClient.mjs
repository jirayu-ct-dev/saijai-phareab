/**
 * Bridge API client for the frozen PRN-04 server contract:
 *   POST /api/admin/print-bridge/heartbeat  {printerId, bridgeVersion}
 *   POST /api/admin/print-bridge/claim      {printerId, maxJobs?}
 *   POST /api/admin/print-bridge/events     {printerId, events: [...]}
 *
 * Every call sends `Authorization: Bearer <bridgeCredential>`. The credential
 * exists ONLY inside the Authorization header — it is never placed in error
 * messages, logs, or any request body. Host/port of the printer never leave
 * this process (they live in local config and are used by the TCP transport).
 */

export class ApiError extends Error {
  constructor(status, path) {
    // Message intentionally excludes headers, body fragments and credentials.
    super(`Print bridge API ${path} failed with HTTP status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

export function createApiClient({ baseUrl, bridgeCredential, printerId, fetchImpl = fetch }) {
  const base = baseUrl.replace(/\/+$/, "");

  async function call(path, body) {
    let response;
    try {
      response = await fetchImpl(base + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bridgeCredential}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Network-layer failure: surface a safe message; never log the error
      // object (it may carry request internals).
      throw new Error(`Print bridge API ${path} could not be reached (network error)`);
    }
    if (!response.ok) {
      throw new ApiError(response.status, path);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`Print bridge API ${path} returned a non-JSON response`);
    }
  }

  return {
    heartbeat(bridgeVersion) {
      return call("/api/admin/print-bridge/heartbeat", { printerId, bridgeVersion });
    },
    claim(maxJobs) {
      return call("/api/admin/print-bridge/claim", { printerId, maxJobs });
    },
    reportEvents(events) {
      return call("/api/admin/print-bridge/events", { printerId, events });
    },
  };
}
