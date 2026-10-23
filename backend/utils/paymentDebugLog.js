const fs = require('fs');
const path = require('path');

const DEBUG_LOG_PATH = path.join(__dirname, '../../.cursor/debug-690fc0.log');
const INGEST_URL = 'http://127.0.0.1:7924/ingest/6705b331-c7ad-48a0-a2e3-fac9d9a62bb9';
const SESSION_ID = '690fc0';

function paymentDebugLog(location, message, data, hypothesisId, runId = 'pre-fix') {
  const payload = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore */
  }
  fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function sanitizeRetrieveResult(result) {
  if (!result || typeof result !== 'object') return {};
  return {
    status: result.status,
    paymentStatus: result.paymentStatus,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    fraudStatus: result.fraudStatus,
    mdStatus: result.mdStatus,
    conversationId: result.conversationId,
  };
}

module.exports = { paymentDebugLog, sanitizeRetrieveResult };
