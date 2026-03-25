/**
 * Validates whether a detected request was truly "delivered" (got a 2xx response).
 * A status of null means the browser never received a response (blocked/failed).
 */

function isDelivered(request) {
  if (!request) return false;
  const s = request.status;
  return s !== null && s >= 200 && s < 300;
}

function validateGTM(detection) {
  return {
    loaded: detection.fired && isDelivered(detection.request),
    status: detection.request?.status ?? 0,
    blocked: detection.request?.blocked ?? false,
  };
}

function validateGoogleAds(detection) {
  return {
    scriptDelivered: isDelivered(detection.request),
    conversionDelivered: isDelivered(detection.conversionRequest),
    scriptStatus: detection.request?.status ?? 0,
    conversionStatus: detection.conversionRequest?.status ?? 0,
    blocked:
      (detection.request?.blocked ?? false) ||
      (detection.conversionRequest?.blocked ?? false),
  };
}

function validateMeta(detection) {
  return {
    scriptDelivered: isDelivered(detection.request),
    eventDelivered: isDelivered(detection.eventRequest),
    scriptStatus: detection.request?.status ?? 0,
    eventStatus: detection.eventRequest?.status ?? 0,
    blocked:
      (detection.request?.blocked ?? false) ||
      (detection.eventRequest?.blocked ?? false),
  };
}

module.exports = { validateGTM, validateGoogleAds, validateMeta };
