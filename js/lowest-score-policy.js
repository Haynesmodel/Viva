// The source game remains canonical and its scores stay available to every
// aggregate; no owner-specific historical exception is applied in Viva.
function isLowestScoreEligible(_game, _side) {
  return true;
}

export { isLowestScoreEligible };
