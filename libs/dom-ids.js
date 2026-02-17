// DOM id helpers
// Keep deterministic short ids to reduce HTML size while preserving uniqueness.

function getViewDomId(context, rawViewId) {
  return getShortDomId(context, 'v', rawViewId);
}

function getFolderDomId(context, rawFolderId) {
  return getShortDomId(context, 'f', rawFolderId);
}

function getElementSelectorDomId(context, rawConceptId) {
  return toBase36(getShortDomIdNumeric(context, 'e', rawConceptId));
}

function getShortDomId(context, kindPrefix, rawId) {
  return String(kindPrefix) + toBase36(getShortDomIdNumeric(context, kindPrefix, rawId));
}

function getShortDomIdNumeric(context, kindPrefix, rawId) {
  var key = String(kindPrefix) + ':' + String(rawId || '');
  if(!context.domIdMap[key]) {
    context.domIdCounter += 1;
    context.domIdMap[key] = context.domIdCounter;
  }
  return context.domIdMap[key];
}
