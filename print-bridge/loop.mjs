/**
 * Main bridge loop (PRN-04):
 *   - heartbeat every heartbeatIntervalMs (default 60s)
 *   - claim+process cycle every pollIntervalMs (default 15000), shortened to
 *     the nearest local RETRY_WAIT backoff due date
 *   - graceful shutdown on SIGINT/SIGTERM: the in-flight job finishes (including
 *     its write and SENT report), then the outbox is flushed and closed.
 */

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Each loop gets its own wake handle so stop() interrupts both sleeps. */
function makeInterruptibleSleep(sleep = defaultSleep) {
  let wake = null;
  const sleepFn = async (ms) => {
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        wake = null;
        resolve();
      }, ms);
      wake = () => {
        wake = null;
        clearTimeout(timer);
        resolve();
      };
    });
  };
  return { sleep: sleepFn, wake: () => wake?.() };
}

export function createBridgeLoop({
  config,
  api,
  runner,
  outbox,
  log = console,
  bridgeVersion,
  sleep = defaultSleep,
  pollIntervalMs,
  heartbeatIntervalMs,
}) {
  const pollMs = pollIntervalMs ?? config?.pollIntervalMs ?? 15000;
  const heartbeatMs = heartbeatIntervalMs ?? config?.heartbeatIntervalMs ?? 60000;

  let running = false;
  let stoppedPromise = null;
  let mainPromise = null;
  let heartbeatPromise = null;
  const mainSleep = makeInterruptibleSleep(sleep);
  const heartbeatSleep = makeInterruptibleSleep(sleep);

  async function heartbeatLoop() {
    while (running) {
      try {
        await api.heartbeat(bridgeVersion);
      } catch (err) {
        log.warn("Heartbeat failed this cycle", err?.message);
      }
      if (!running) break;
      await heartbeatSleep.sleep(heartbeatMs);
    }
  }

  async function mainLoop() {
    while (running) {
      try {
        await runner.runOnce();
      } catch (err) {
        // Includes the per-printer mutex rejection: an overlapping loop must
        // never run concurrently for the same printer.
        log.error("Bridge cycle failed", err?.message);
      }
      if (!running) break;
      let due = null;
      try {
        due = await runner.earliestRetryDue();
      } catch {
        due = null;
      }
      const waitMs =
        typeof due === "number" ? Math.min(pollMs, Math.max(0, due - Date.now())) : pollMs;
      await mainSleep.sleep(waitMs);
    }
  }

  return {
    isRunning() {
      return running;
    },

    start() {
      if (running) return stoppedPromise;
      running = true;
      mainPromise = mainLoop();
      stoppedPromise = mainPromise.then(() => {});
      heartbeatPromise = heartbeatLoop();
      return stoppedPromise;
    },

    /** Stops the loop; resolves once the in-flight cycle finished and the outbox closed. */
    async stop() {
      if (!mainPromise) return;
      running = false;
      mainSleep.wake();
      heartbeatSleep.wake();
      await mainPromise;
      await heartbeatPromise.catch(() => {});
      await outbox.close();
    },

    /** start() + await shutdown; used by bin/bridge.mjs. */
    async runForever() {
      const shutdown = this.start();
      await shutdown;
    },
  };
}
