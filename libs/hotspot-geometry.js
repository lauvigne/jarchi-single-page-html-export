// Hotspot geometry/rendering helpers
// This module turns view diagram elements into positioned hotspots and element panels.

var hotspotGeometryContext = {
  _: null,
  tplViewHotspotCompact: null,
  getViewDomId: null,
  getElementSelectorDomId: null,
  getDiagramNodeHotspotTarget: null,
  isViewReferenceDiagramType: null,
  hotspotDebugEnabled: false,
  debugFallbackByNodeKey: {},
  renderedBoundsUnavailableLogged: false
};

function initHotspotGeometry(context) {
  hotspotGeometryContext = context || {};
  if(!hotspotGeometryContext.debugFallbackByNodeKey) hotspotGeometryContext.debugFallbackByNodeKey = {};
  hotspotGeometryContext.renderedBoundsUnavailableLogged = false;
}

function buildViewInteraction(view, viewImageSize, hotspotZoomFactor) {
  var orderedEntries = collectOrderedViewEntries(view, hotspotZoomFactor);
  if(!orderedEntries.length) return emptyViewInteraction();

  var diagramBounds = calculateIntBounds(view, hotspotZoomFactor);
  if(!diagramBounds) return emptyViewInteraction();

  var normalization = normalizeEntriesForRenderedImage(orderedEntries, diagramBounds, viewImageSize, hotspotZoomFactor);
  if(!normalization || !normalization.entries.length || !normalization.extents) {
    return emptyViewInteraction();
  }

  logHotspotGeometryDebug(view, diagramBounds, normalization);

  var rendered = buildHotspotsAndPanels(normalization.entries, normalization.extents, normalization.debugBounds, normalization.debugNodes);

  return {
    hotspots: rendered.hotspots,
    panels: rendered.panels
  };
}

function logHotspotGeometryDebug(view, diagramBounds, normalization) {
  if(hotspotGeometryContext.hotspotDebugEnabled !== true) return;
  var viewName = String((view && view.name) || '');
  if(viewName.indexOf('CBK Euro - Interbank Incoming') === -1) return;

  console.log(
    '[hotspot-debug] view="' + viewName + '"' +
    ' image=' + String((normalization.extents && normalization.extents.width) || 0) + 'x' + String((normalization.extents && normalization.extents.height) || 0) +
    ' diagramBounds(minX=' + String(diagramBounds.minX) + ',minY=' + String(diagramBounds.minY) +
    ',w=' + String(diagramBounds.width) + ',h=' + String(diagramBounds.height) + ')'
  );

  var sampleCount = 0;
  hotspotGeometryContext._.each(normalization.entries || [], function(entry) {
    if(sampleCount >= 12) return;
    var name = String((entry && entry.concept && entry.concept.name) || '');
    if(!name) return;
    console.log(
      '[hotspot-debug] entry #' + String(sampleCount + 1) + ' "' + name + '"' +
      ' x=' + String(entry.x) + ' y=' + String(entry.y) +
      ' w=' + String(entry.width) + ' h=' + String(entry.height)
    );
    sampleCount++;
  });
}

function emptyViewInteraction() {
  return {
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

function normalizeEntriesForRenderedImage(orderedEntries, diagramBounds, viewImageSize, zoom) {
  var rootOffsets = computeRootOffsets(diagramBounds, viewImageSize, zoom);
  var normalizedEntries = [];
  var debugNodes = [];
  hotspotGeometryContext._.each(orderedEntries, function(entry) {
    var debugNode = toNormalizedDebugNode(entry, rootOffsets.rootOffsetX, rootOffsets.rootOffsetY);
    if(debugNode) debugNodes.push(debugNode);
    var normalized = toNormalizedEntry(entry, rootOffsets.rootOffsetX, rootOffsets.rootOffsetY);
    if(normalized) normalizedEntries.push(normalized);
  });
  if(!normalizedEntries.length) return null;

  var extents = resolveHotspotExtents(normalizedEntries, viewImageSize);
  if(!extents) return null;

  return {
    entries: normalizedEntries,
    extents: extents,
    debugBounds: {
      x: diagramBounds.minX + rootOffsets.rootOffsetX,
      y: diagramBounds.minY + rootOffsets.rootOffsetY,
      width: diagramBounds.width,
      height: diagramBounds.height
    },
    debugNodes: debugNodes
  };
}

function collectBoundsRecursive(diagramElement, offsetX, offsetY, zoom, entries) {
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

  entries.push({
    x1: x,
    y1: y,
    x2: x + w,
    y2: y + h
  });

  var children = [];
  $(diagramElement).children().each(function(child) {
    children.push(child);
  });
  for(var i = children.length - 1; i >= 0; i--) {
    var child = children[i];
    var childOffsetX = x;
    var childOffsetY = y;
    if(!isChildBoundsRelativeToParent(child, localW, localH)) {
      childOffsetX = 0;
      childOffsetY = 0;
    }
    collectBoundsRecursive(child, childOffsetX, childOffsetY, zoom, entries);
  }
}

function filterRenderableEntries(entries) {
  var filtered = [];
  hotspotGeometryContext._.each(entries || [], function(entry) {
    if(!entry || !entry.concept) return;
    var width = entry.x2 - entry.x1;
    var height = entry.y2 - entry.y1;
    if(width <= 0 || height <= 0) return;
    filtered.push(entry);
  });
  return filtered;
}

function computeRootOffsets(diagramBounds, viewImageSize, zoom) {
  var rootOffsetX = 0;
  var rootOffsetY = 0;
  if(viewImageSize && viewImageSize.width > 0 && viewImageSize.height > 0) {
    // Archi renderViewToFile applies a default 10px margin when options.margin is not set.
    // With export scale=zoom, this becomes (10 * zoom) pixels in the rendered PNG.
    var marginPx = toInt(10 * zoom);
    rootOffsetX = -diagramBounds.minX + marginPx;
    rootOffsetY = -diagramBounds.minY + marginPx;
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

function toNormalizedDebugNode(entry, rootOffsetX, rootOffsetY) {
  if(!entry) return null;
  var width = entry.x2 - entry.x1;
  var height = entry.y2 - entry.y1;
  if(width <= 0 || height <= 0) return null;
  return {
    id: String(entry.diagramElementId || ''),
    type: String(entry.diagramElementType || ''),
    x: entry.x1 + rootOffsetX,
    y: entry.y1 + rootOffsetY,
    width: width,
    height: height,
    usedAbsoluteFallback: entry.usedAbsoluteFallback === true
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

function buildHotspotsAndPanels(normalizedEntries, extents, debugBounds, debugNodes) {
  var hotspotEntries = [];

  hotspotGeometryContext._.each(normalizedEntries, function(entry) {
    var hotspotEntry = buildHotspotEntry(entry, extents);
    if(!hotspotEntry) return;
    hotspotEntries.push(hotspotEntry);
  });

  var orderedHotspots = orderHotspotsForRendering(hotspotEntries);
  return {
    hotspots: renderHotspots(orderedHotspots),
    panels: renderDebugPanels(debugBounds, extents, debugNodes)
  };
}

function renderDebugPanels(debugBounds, extents, debugNodes) {
  if(hotspotGeometryContext.hotspotDebugEnabled !== true) return '';
  var parts = [];

  var percent = boundsToPercent(debugBounds, extents);
  if(percent) {
    parts.push('<div class="view-debug-bounds" style="left:' + String(percent.left) + '%;top:' + String(percent.top) + '%;width:' +
      String(percent.width) + '%;height:' + String(percent.height) + '%;"></div>');
  }

  hotspotGeometryContext._.each(debugNodes || [], function(node) {
    var nodePercent = boundsToPercent(node, extents);
    if(!nodePercent) return;
    var cssClass = node.usedAbsoluteFallback === true ? 'view-debug-node view-debug-node-abs' : 'view-debug-node view-debug-node-rel';
    var label = hotspotGeometryContext._.escape((node.type || 'node') + (node.id ? ' #' + node.id : ''));
    parts.push('<div class="' + cssClass + '" title="' + label + '" style="left:' + String(nodePercent.left) + '%;top:' +
      String(nodePercent.top) + '%;width:' + String(nodePercent.width) + '%;height:' + String(nodePercent.height) + '%;"></div>');
  });
  return parts.join('');
}

function buildHotspotEntry(entry, extents) {
  var percent = boundsToPercent(entry, extents);
  if(!percent) return null;

  var isViewRef = entry.concept && entry.concept.isViewRef === true && entry.concept.targetViewId;
  var selectorId = isViewRef
    ? hotspotGeometryContext.getViewDomId(String(entry.concept.targetViewId))
    : hotspotGeometryContext.getElementSelectorDomId(String(entry.concept.id));

  return {
    selectorId: selectorId,
    elementName: hotspotGeometryContext._.escape(entry.concept.name || ''),
    left: percent.left,
    top: percent.top,
    width: percent.width,
    height: percent.height,
    isViewRef: isViewRef,
    area: entry.width * entry.height
  };
}

function orderHotspotsForRendering(hotspotEntries) {
  var byAreaDesc = hotspotGeometryContext._.sortBy(hotspotEntries, function(h) { return -h.area; });
  var standardHotspots = [];
  var viewRefHotspots = [];
  hotspotGeometryContext._.each(byAreaDesc, function(h) {
    if(h.isViewRef) viewRefHotspots.push(h);
    else standardHotspots.push(h);
  });
  return standardHotspots.concat(viewRefHotspots);
}

function renderHotspots(hotspotEntries) {
  var hotspotTemplate = hotspotGeometryContext.tplViewHotspotCompact;
  if(typeof hotspotTemplate === 'function') hotspotTemplate = hotspotTemplate();
  var parts = [];
  hotspotGeometryContext._.each(hotspotEntries, function(h, index) {
    parts.push(hotspotTemplate({
      selectorId: h.selectorId,
      elementName: h.elementName,
      left: h.left,
      top: h.top,
      width: h.width,
      height: h.height,
      zIndex: 10 + index
    }));
  });
  return parts.join('');
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

  var usedAbsoluteFallback = false;
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
      usedAbsoluteFallback = true;
      logAbsoluteFallback(diagramElement, child, localW, localH);
    }
    collectEntriesRecursive(child, childOffsetX, childOffsetY, zoom, entries, currentViewId);
  }

  entries.push({
    concept: hotspotGeometryContext.getDiagramNodeHotspotTarget(diagramElement, currentViewId),
    diagramElementId: diagramElement.id,
    diagramElementType: diagramElement.type,
    usedAbsoluteFallback: usedAbsoluteFallback,
    x1: x,
    y1: y,
    x2: x + w,
    y2: y + h
  });
}

function logAbsoluteFallback(parentElement, childElement, parentWidth, parentHeight) {
  if(hotspotGeometryContext.hotspotDebugEnabled !== true) return;
  var childId = String((childElement && childElement.id) || '');
  var childType = String((childElement && childElement.type) || '');
  var key = childId ? childId : (childType + ':' + String((childElement && childElement.name) || ''));
  if(hotspotGeometryContext.debugFallbackByNodeKey[key]) return;
  hotspotGeometryContext.debugFallbackByNodeKey[key] = true;

  var childX = childElement && childElement.bounds ? toNumber(childElement.bounds.x) : null;
  var childY = childElement && childElement.bounds ? toNumber(childElement.bounds.y) : null;
  var childW = childElement && childElement.bounds ? toNumber(childElement.bounds.width) : null;
  var childH = childElement && childElement.bounds ? toNumber(childElement.bounds.height) : null;

  console.log(
    '[hotspot-debug] absolute fallback for child id=' + childId +
    ' type=' + childType +
    ' parentId=' + String((parentElement && parentElement.id) || '') +
    ' childBounds=(' + String(childX) + ',' + String(childY) + ',' + String(childW) + ',' + String(childH) + ')' +
    ' parentSize=(' + String(parentWidth) + ',' + String(parentHeight) + ')'
  );
}

function isDiagramNodeHotspotCandidate(diagramElement) {
  if(!diagramElement || !diagramElement.type) return false;
  if(hotspotGeometryContext.isViewReferenceDiagramType(diagramElement.type)) return true;
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
  // Embedded labels/notes can exceed parent bounds by a few pixels in some views.
  // Keep a generous tolerance before switching to absolute fallback.
  var tolerance = 16;
  var withinRelativeTolerance = x >= -tolerance &&
    y >= -tolerance &&
    (x + w) <= (parentWidth + tolerance) &&
    (y + h) <= (parentHeight + tolerance);
  if(withinRelativeTolerance) return true;

  // Safety net for nested visual note fragments that are logically relative
  // but can spill slightly outside the parent in exported geometry.
  var childType = String(childElement.type || '').toLowerCase();
  var isNestedNote = childType === 'diagram-model-note';
  if(isNestedNote) {
    var noteTolerance = 36;
    return x >= -noteTolerance &&
      y >= -noteTolerance &&
      (x + w) <= (parentWidth + noteTolerance) &&
      (y + h) <= (parentHeight + noteTolerance);
  }
  return false;
}

function calculateIntBounds(view, zoom) {
  if(!view) return null;

  // Preferred path: use the same rendered-figure bounds strategy as Archi Reports.
  var renderedBounds = calculateRenderedFigureBounds(view, zoom);
  if(renderedBounds) return renderedBounds;

  var entries = [];
  $(view).children().each(function(diagramElement) {
    collectBoundsRecursive(diagramElement, 0, 0, zoom, entries);
  });
  if(!entries.length) return null;

  var minX = null, minY = null, maxX = null, maxY = null;
  hotspotGeometryContext._.each(entries, function(e) {
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

function calculateRenderedFigureBounds(view, zoom) {
  try {
    var DiagramUtils = Java.type('com.archimatetool.editor.diagram.util.DiagramUtils');
    var ImageFactory = Java.type('com.archimatetool.editor.ui.ImageFactory');
    var geoImage = DiagramUtils.createModelReferencedImage(view, 1, 10);
    if(!geoImage) return null;

    try {
      var bounds = geoImage.getBounds();
      if(!bounds) return null;

      var deviceScale = 1;
      try {
        var rawDeviceZoom = Number(ImageFactory.getImageDeviceZoom());
        if(rawDeviceZoom > 0) deviceScale = rawDeviceZoom / 100;
      }
      catch(ignoreDeviceZoom) {}

      var exportScale = Number(zoom);
      if(!(exportScale > 0)) exportScale = 1;
      var scale = deviceScale * exportScale;

      var minX = toInt(Number(bounds.x) * scale);
      var minY = toInt(Number(bounds.y) * scale);
      var width = toInt(Number(bounds.width) * scale);
      var height = toInt(Number(bounds.height) * scale);
      if(width <= 0 || height <= 0) return null;

      return {
        minX: minX,
        minY: minY,
        width: width,
        height: height
      };
    }
    finally {
      try {
        var renderedImage = geoImage.getImage();
        if(renderedImage) renderedImage.dispose();
      }
      catch(ignoreDispose) {}
    }
  }
  catch(err) {
    if(hotspotGeometryContext.hotspotDebugEnabled === true && hotspotGeometryContext.renderedBoundsUnavailableLogged !== true) {
      hotspotGeometryContext.renderedBoundsUnavailableLogged = true;
      console.log('[hotspot-debug] calculateRenderedFigureBounds fallback to recursive bounds: ' + toErrorMessage(err));
    }
    return null;
  }
}

function calculateExtents(entries) {
  if(!entries || !entries.length) return null;
  var minX = null, minY = null, maxX = null, maxY = null;
  hotspotGeometryContext._.each(entries, function(entry) {
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
