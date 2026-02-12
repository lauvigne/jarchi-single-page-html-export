// Hotspot geometry/rendering helpers
// This module turns view diagram elements into positioned hotspots and element panels.

function buildViewInteraction(view, viewImageSize, hotspotZoomFactor) {
  var selectorName = 'selected-element-' + view.id;
  var noneSelectorId = 'selected-element-none-' + view.id;
  var orderedEntries = collectOrderedViewEntries(view, hotspotZoomFactor);
  if(!orderedEntries.length) return emptyViewInteraction(selectorName, noneSelectorId);

  var normalization = normalizeEntriesForRenderedImage(orderedEntries, viewImageSize);
  if(!normalization || !normalization.entries.length || !normalization.extents) {
    return emptyViewInteraction(selectorName, noneSelectorId);
  }

  var rendered = buildHotspotsAndPanels(
    normalization.entries,
    normalization.extents,
    String(view.id),
    selectorName,
    noneSelectorId
  );

  return {
    selectorName: selectorName,
    noneSelectorId: noneSelectorId,
    hotspots: rendered.hotspots,
    panels: rendered.panels
  };
}

function emptyViewInteraction(selectorName, noneSelectorId) {
  return {
    selectorName: selectorName,
    noneSelectorId: noneSelectorId,
    hotspots: '',
    panels: ''
  };
}

function collectOrderedViewEntries(view, zoom) {
  var orderedEntries = [];
  var roots = [];
  $(view).children().filter(o => isDiagramNodeHotspotCandidate(o)).each(function(e) {
    roots.push(e);
  });
  for(var i = roots.length - 1; i >= 0; i--) {
    collectEntriesRecursive(roots[i], 0, 0, zoom, orderedEntries, String(view.id));
  }
  return orderedEntries;
}

function normalizeEntriesForRenderedImage(orderedEntries, viewImageSize) {
  var diagramBounds = calculateIntBounds(orderedEntries);
  if(!diagramBounds) return null;

  var rootOffsets = computeRootOffsets(diagramBounds, viewImageSize);
  var normalizedEntries = [];
  _.each(orderedEntries, function(entry) {
    var normalized = toNormalizedEntry(entry, rootOffsets.rootOffsetX, rootOffsets.rootOffsetY);
    if(normalized) normalizedEntries.push(normalized);
  });
  if(!normalizedEntries.length) return null;

  var extents = resolveHotspotExtents(normalizedEntries, viewImageSize);
  if(!extents) return null;

  return {
    entries: normalizedEntries,
    extents: extents
  };
}

function computeRootOffsets(diagramBounds, viewImageSize) {
  var rootOffsetX = 0;
  var rootOffsetY = 0;
  if(viewImageSize && viewImageSize.width > 0 && viewImageSize.height > 0) {
    // renderViewToFile crops to minimum diagram bounds and keeps only uniform margins.
    // Re-anchor absolute diagram coordinates to the exported image origin.
    var marginX = toInt((viewImageSize.width - diagramBounds.width) / 2);
    var marginY = toInt((viewImageSize.height - diagramBounds.height) / 2);
    if(marginX < 0) marginX = 0;
    if(marginY < 0) marginY = 0;
    rootOffsetX = -diagramBounds.minX + marginX;
    rootOffsetY = -diagramBounds.minY + marginY;
  } else {
    // Fallback only: without image dimensions, normalize coordinates to top-left.
    rootOffsetX = -diagramBounds.minX;
    rootOffsetY = -diagramBounds.minY;
  }
  return {
    rootOffsetX: rootOffsetX,
    rootOffsetY: rootOffsetY
  };
}

function toNormalizedEntry(entry, rootOffsetX, rootOffsetY) {
  if(!entry || !entry.concept) return null;
  var width = entry.x2 - entry.x1;
  var height = entry.y2 - entry.y1;
  if(width <= 0 || height <= 0) return null;
  return {
    concept: entry.concept,
    x: entry.x1 + rootOffsetX,
    y: entry.y1 + rootOffsetY,
    width: width,
    height: height
  };
}

function resolveHotspotExtents(normalizedEntries, viewImageSize) {
  if(viewImageSize && viewImageSize.width > 0 && viewImageSize.height > 0) {
    return {
      minX: 0,
      minY: 0,
      width: viewImageSize.width,
      height: viewImageSize.height
    };
  }
  return calculateExtents(normalizedEntries);
}

function buildHotspotsAndPanels(normalizedEntries, extents, viewId, selectorName, noneSelectorId) {
  var hotspotEntries = [];
  var panels = '';
  var seenConcepts = {};

  _.each(normalizedEntries, function(entry) {
    var hotspotEntry = buildHotspotEntry(entry, extents, viewId);
    if(!hotspotEntry) return;
    hotspotEntries.push(hotspotEntry);

    if(hotspotEntry.isViewRef) return;
    var conceptId = String(entry.concept.id);
    if(seenConcepts[conceptId]) return;
    seenConcepts[conceptId] = true;
    panels += renderElementPanel(entry.concept, hotspotEntry.selectorId, selectorName, noneSelectorId);
  });

  var orderedHotspots = orderHotspotsForRendering(hotspotEntries);
  return {
    hotspots: renderHotspots(orderedHotspots),
    panels: panels
  };
}

function buildHotspotEntry(entry, extents, viewId) {
  var percent = boundsToPercent(entry, extents);
  if(!percent) return null;

  var isViewRef = entry.concept && entry.concept.isViewRef === true && entry.concept.targetViewId;
  var selectorId = isViewRef
    ? 'id-' + String(entry.concept.targetViewId)
    : 'selected-element-' + viewId + '-' + String(entry.concept.id);

  return {
    selectorId: selectorId,
    elementName: _.escape(entry.concept.name || ''),
    left: percent.left,
    top: percent.top,
    width: percent.width,
    height: percent.height,
    isViewRef: isViewRef,
    area: entry.width * entry.height,
    debugText: 'px[' + entry.x + ',' + entry.y + ' ' + entry.width + 'x' + entry.height + '] %[' + percent.left + ',' + percent.top + ' ' + percent.width + 'x' + percent.height + ']'
  };
}

function renderElementPanel(concept, selectorId, selectorName, noneSelectorId) {
  return tplViewElementPanel({
    selectorId: selectorId,
    selectorName: selectorName,
    noneSelectorId: noneSelectorId,
    elementName: _.escape(concept.name || '(Unnamed)'),
    elementType: properCase(String(concept.type || '')),
    elementDocumentationText: _.escape(concept.documentation || '').replace(/\n/g, '<br>'),
    elementDocumentationMarkdown: marked(_.escape(concept.documentation || ''), mdOptions)
  });
}

function orderHotspotsForRendering(hotspotEntries) {
  var byAreaDesc = _.sortBy(hotspotEntries, function(h) { return -h.area; });
  var standardHotspots = [];
  var viewRefHotspots = [];
  _.each(byAreaDesc, function(h) {
    if(h.isViewRef) viewRefHotspots.push(h);
    else standardHotspots.push(h);
  });
  return standardHotspots.concat(viewRefHotspots);
}

function renderHotspots(hotspotEntries) {
  var hotspots = '';
  var hotspotTemplate = debugHotspots ? tplViewHotspotDebug : tplViewHotspotCompact;
  _.each(hotspotEntries, function(h, index) {
    hotspots += hotspotTemplate({
      selectorId: h.selectorId,
      elementName: h.elementName,
      left: h.left,
      top: h.top,
      width: h.width,
      height: h.height,
      zIndex: 10 + index,
      debugText: h.debugText
    });
  });
  return hotspots;
}

function collectEntriesRecursive(diagramElement, offsetX, offsetY, zoom, entries, currentViewId) {
  if(!diagramElement || !diagramElement.bounds) return;

  var localX = toNumber(diagramElement.bounds.x);
  var localY = toNumber(diagramElement.bounds.y);
  var localW = toNumber(diagramElement.bounds.width);
  var localH = toNumber(diagramElement.bounds.height);
  if(localX === null || localY === null || localW === null || localH === null) return;
  if(localW <= 0 || localH <= 0) return;

  var x = toInt(localX * zoom) + offsetX;
  var y = toInt(localY * zoom) + offsetY;
  var w = toInt(localW * zoom);
  var h = toInt(localH * zoom);
  if(w <= 0 || h <= 0) return;

  var children = [];
  $(diagramElement).children().filter(o => isDiagramNodeHotspotCandidate(o)).each(function(child) {
    children.push(child);
  });
  for(var i = children.length - 1; i >= 0; i--) {
    var child = children[i];
    var childOffsetX = x;
    var childOffsetY = y;
    if(!isChildBoundsRelativeToParent(child, localW, localH)) {
      // Some nested elements already carry absolute view coordinates.
      childOffsetX = 0;
      childOffsetY = 0;
    }
    collectEntriesRecursive(child, childOffsetX, childOffsetY, zoom, entries, currentViewId);
  }

  entries.push({
    concept: getDiagramNodeHotspotTarget(diagramElement, currentViewId),
    x1: x,
    y1: y,
    x2: x + w,
    y2: y + h
  });
}

function isDiagramNodeHotspotCandidate(diagramElement) {
  if(!diagramElement || !diagramElement.type) return false;
  if(isViewReferenceDiagramType(diagramElement.type)) return true;
  return !isRelationshipDiagramType(diagramElement.type);
}

function isRelationshipDiagramType(type) {
  if(!type) return false;
  return String(type).toLowerCase().indexOf('relationship') !== -1;
}

function isChildBoundsRelativeToParent(childElement, parentWidth, parentHeight) {
  if(!childElement || !childElement.bounds) return false;
  var x = toNumber(childElement.bounds.x);
  var y = toNumber(childElement.bounds.y);
  var w = toNumber(childElement.bounds.width);
  var h = toNumber(childElement.bounds.height);
  if(x === null || y === null || w === null || h === null) return false;
  if(w <= 0 || h <= 0) return false;
  var tolerance = 1;
  return x >= -tolerance &&
    y >= -tolerance &&
    (x + w) <= (parentWidth + tolerance) &&
    (y + h) <= (parentHeight + tolerance);
}

function calculateIntBounds(entries) {
  if(!entries || !entries.length) return null;
  var minX = null, minY = null, maxX = null, maxY = null;
  _.each(entries, function(e) {
    if(minX === null || e.x1 < minX) minX = e.x1;
    if(minY === null || e.y1 < minY) minY = e.y1;
    if(maxX === null || e.x2 > maxX) maxX = e.x2;
    if(maxY === null || e.y2 > maxY) maxY = e.y2;
  });
  if(minX === null || minY === null || maxX === null || maxY === null) return null;
  return {
    minX: minX,
    minY: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function calculateExtents(entries) {
  if(!entries || !entries.length) return null;
  var minX = null, minY = null, maxX = null, maxY = null;
  _.each(entries, function(entry) {
    if(minX === null || entry.x < minX) minX = entry.x;
    if(minY === null || entry.y < minY) minY = entry.y;
    if(maxX === null || (entry.x + entry.width) > maxX) maxX = entry.x + entry.width;
    if(maxY === null || (entry.y + entry.height) > maxY) maxY = entry.y + entry.height;
  });
  if(minX === null || minY === null || maxX === null || maxY === null) return null;
  var width = maxX - minX;
  var height = maxY - minY;
  if(width <= 0 || height <= 0) return null;
  return { minX: minX, minY: minY, width: width, height: height };
}

function boundsToPercent(bounds, extents) {
  if(!bounds || !extents) return null;
  var left = ((bounds.x - extents.minX) * 100) / extents.width;
  var top = ((bounds.y - extents.minY) * 100) / extents.height;
  var width = (bounds.width * 100) / extents.width;
  var height = (bounds.height * 100) / extents.height;
  return {
    left: round2(clampPercent(left)),
    top: round2(clampPercent(top)),
    width: round2(clampPercent(width)),
    height: round2(clampPercent(height))
  };
}

function clampPercent(v) {
  if(v < 0) return 0;
  if(v > 100) return 100;
  return v;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function toNumber(value) {
  var n = Number(value);
  if(isNaN(n)) return null;
  return n;
}

function toInt(value) {
  var n = Number(value);
  if(isNaN(n)) return 0;
  if(n < 0) return Math.ceil(n);
  return Math.floor(n);
}
