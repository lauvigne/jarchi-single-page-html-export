// ViewRef target resolution helpers
//
// Purpose:
// Resolve "archimate-diagram-model" nodes (view references) to the target view ID
// used by exported hotspots.
//
// Why this module exists:
// Depending on Archi/jArchi/runtime proxy shape, direct fields can be incomplete
// or can resolve to the current/source view. We therefore use a layered strategy:
// 1) Resolve by displayed name (preferred, most stable in our models)
// 2) Resolve from common direct candidate fields
// 3) Resolve via deep object traversal with key-based scoring
// 4) Last fallback by name candidates extracted from available fields
//
// Important behavior:
// If resolution points only to current view, return null to avoid no-op hotspots.

var viewRefResolutionContext = {
  model: null,
  _: null,
  console: null
};

function initViewRefResolution(context) {
  viewRefResolutionContext = context || {};
  // Reset caches for each export run/context to avoid stale mappings
  // when model content changes or when script is re-executed.
  viewNameById = null;
  viewIdByName = null;
}

function getViewRefModel() {
  return viewRefResolutionContext.model || model;
}

function getViewRefUnderscore() {
  return viewRefResolutionContext._ || _;
}

function isViewReferenceDiagramType(type) {
  if(!type) return false;
  return String(type).toLowerCase() === 'archimate-diagram-model';
}

function getDiagramNodeHotspotTarget(diagramElement, currentViewId) {
  if(!diagramElement) return null;
  if(diagramElement.concept && diagramElement.concept.id) return diagramElement.concept;
  if(!isViewReferenceDiagramType(diagramElement.type)) return null;

  // For view references, displayed label usually matches target view name.
  // Prefer this over proxy fields that may resolve to source/current view.
  var targetViewId = resolveViewIdByName(diagramElement.name, currentViewId);
  if(!targetViewId) {
    targetViewId = resolveReferencedViewId(diagramElement, currentViewId);
  }
  if(!targetViewId) {
    return null;
  }
  var referencedViewName = getViewNameById(targetViewId);
  return {
    id: 'viewref-' + String(diagramElement.id || targetViewId || ''),
    name: referencedViewName || diagramElement.name || '(View Reference)',
    type: 'view-reference',
    isViewRef: true,
    targetViewId: String(targetViewId),
    documentation: ''
  };
}

// Central cache: View ID -> View Name
// This is used by multiple resolution paths and hotspot labeling.
// It is lazily populated once per initViewRefResolution() context.
var viewNameById = null;
function ensureViewNameByIdLoaded() {
  if(viewNameById) return;
  // Cache once: ID -> Name
  viewNameById = {};
  $(getViewRefModel()).find('view').each(function(v) {
    if(v && v.id) viewNameById[String(v.id)] = v.name || '';
  });
}

function getViewNameById(viewId) {
  if(!viewId) return null;
  ensureViewNameByIdLoaded();
  return viewNameById[String(viewId)] || null;
}

function hasViewId(viewId) {
  if(!viewId) return false;
  ensureViewNameByIdLoaded();
  return Object.prototype.hasOwnProperty.call(viewNameById, String(viewId));
}

function resolveReferencedViewId(diagramElement, currentViewId) {
  if(!diagramElement) return null;
  var candidates = getReferencedViewCandidates(diagramElement);
  var directResolution = resolveViewIdFromDirectCandidates(candidates, currentViewId);
  if(directResolution.resolved) return directResolution.resolved;

  // Generic fallback: inspect object graph to find values matching known view IDs.
  var deepId = resolveReferencedViewIdDeep(diagramElement, currentViewId);
  if(deepId) return deepId;

  // Fallback by name when API exposes only the referenced view label.
  var byName = resolveViewIdFromNameCandidates(candidates, diagramElement, currentViewId);
  if(byName) return byName;

  // If we only resolved the current view, ignore this viewRef hotspot:
  // selecting the same radio is a no-op and feels broken for users.
  if(directResolution.fallbackCurrent) return null;
  return null;
}

function getReferencedViewCandidates(diagramElement) {
  // Common proxy fields observed across versions.
  return [
    diagramElement.referencedView,
    diagramElement.referencedModel,
    diagramElement.viewRef,
    diagramElement.view,
    diagramElement.model,
    diagramElement.targetView,
    diagramElement.target
  ];
}

function resolveViewIdFromDirectCandidates(candidates, currentViewId) {
  var fallbackCurrent = null;
  for(var i = 0; i < candidates.length; i++) {
    var id = extractPotentialViewId(candidates[i]);
    if(!id || !hasViewId(id)) continue;
    if(currentViewId && String(id) === String(currentViewId)) {
      if(!fallbackCurrent) fallbackCurrent = String(id);
      continue;
    }
    return {
      resolved: String(id),
      fallbackCurrent: fallbackCurrent
    };
  }
  return {
    resolved: null,
    fallbackCurrent: fallbackCurrent
  };
}

function resolveViewIdFromNameCandidates(candidates, diagramElement, currentViewId) {
  var nameCandidates = [];
  getViewRefUnderscore().each(candidates, function(candidate) {
    nameCandidates.push(extractPotentialViewName(candidate));
  });
  nameCandidates.push(extractPotentialViewName(diagramElement));

  for(var i = 0; i < nameCandidates.length; i++) {
    var byNameId = resolveViewIdByName(nameCandidates[i], currentViewId);
    if(byNameId) return byNameId;
  }
  return null;
}

function extractPotentialViewId(candidate) {
  if(!candidate) return null;
  try {
    if(typeof candidate === 'string') return String(candidate);
    if(candidate.id) return String(candidate.id);
    if(candidate.ref && candidate.ref.id) return String(candidate.ref.id);
  }
  catch(err) {}
  return null;
}

function extractPotentialViewName(candidate) {
  if(!candidate) return null;
  try {
    if(typeof candidate === 'string') return null;
    if(candidate.name) return String(candidate.name);
    if(candidate.ref && candidate.ref.name) return String(candidate.ref.name);
  }
  catch(err) {}
  return null;
}

var viewIdByName = null;
function ensureViewIdByNameLoaded() {
  if(viewIdByName) return;
  // Reverse index: Name -> [IDs] (name is not guaranteed unique).
  viewIdByName = {};
  $(getViewRefModel()).find('view').each(function(v) {
    if(!v || !v.id || !v.name) return;
    var key = String(v.name);
    if(!viewIdByName[key]) viewIdByName[key] = [];
    viewIdByName[key].push(String(v.id));
  });
}

function resolveViewIdByName(viewName, currentViewId) {
  if(!viewName) return null;
  ensureViewIdByNameLoaded();
  var ids = viewIdByName[String(viewName)];
  if(!ids || !ids.length) return null;
  if(ids.length === 1) return ids[0];
  // When duplicate names exist, prefer ID different from source/current view.
  for(var i = 0; i < ids.length; i++) {
    if(!currentViewId || String(ids[i]) !== String(currentViewId)) return ids[i];
  }
  return ids[0];
}

function resolveReferencedViewIdDeep(diagramElement, currentViewId) {
  // Defensive bounded traversal to avoid heavy scans/cycles.
  // Depth is capped and object instances are tracked in "visited".
  var visited = [];
  var best = null;
  var bestScore = -999999;

  function seen(obj) {
    for(var i = 0; i < visited.length; i++) {
      if(visited[i] === obj) return true;
    }
    return false;
  }

  function scoreForKey(key) {
    // Heuristic weights: keys semantically linked to view references rank higher.
    var k = String(key || '').toLowerCase();
    var score = 0;
    if(k.indexOf('referenced') !== -1) score += 6;
    if(k.indexOf('target') !== -1) score += 5;
    if(k.indexOf('view') !== -1) score += 5;
    if(k.indexOf('model') !== -1) score += 2;
    if(k === 'id') score += 1;
    return score;
  }

  function consider(id, score) {
    if(!id || !hasViewId(id)) return;
    var s = score;
    if(currentViewId && String(id) === String(currentViewId)) s -= 100;
    if(s > bestScore) {
      bestScore = s;
      best = String(id);
    }
  }

  function visit(value, depth, keyHint) {
    if(value === null || value === undefined) return;
    if(depth > 3) return;
    var t = typeof value;
    if(t === 'string') {
      // Some proxies expose only raw string IDs.
      consider(String(value), scoreForKey(keyHint));
      return;
    }
    if(t !== 'object' && t !== 'function') return;
    if(seen(value)) return;
    visited.push(value);

    try {
      if(value.id) {
        consider(String(value.id), scoreForKey(keyHint) + 1);
      }
      if(value.ref && value.ref.id) {
        consider(String(value.ref.id), scoreForKey(keyHint) + 2);
      }
    }
    catch(err) {}

    // Properties inspected first during deep traversal.
    // Ordered from most likely to contain target view references to generic fields.
    var props = [
      'referencedView', 'referencedModel', 'viewRef', 'view', 'model', 'targetView', 'target',
      'ref', 'id'
    ];
    for(var i = 0; i < props.length; i++) {
      var p = props[i];
      try {
        if(value[p] !== undefined && value[p] !== null) {
          visit(value[p], depth + 1, p);
        }
      }
      catch(err) {}
    }
  }

  // Start traversal from the diagram element itself.
  visit(diagramElement, 0, 'root');
  if(!best) return null;
  // Extra safeguard: never return source/current view as deep-resolution result.
  if(currentViewId && String(best) === String(currentViewId)) return null;
  return best;
}
