// Model collection and panel rendering helpers
// Collect unique concepts per view and build side panel/table artifacts.

function recordViewConcepts(context, view) {
  $(view).find('element').each(function(diagramElement) {
    collectElementConcept(context, diagramElement.concept);
    addViewClassTokenForConcept(context, diagramElement.concept && diagramElement.concept.id, view.id);
  });

  $(view).find('relationship').each(function(diagramRelationship) {
    collectRelationshipConcept(context, diagramRelationship.concept);
    addViewClassTokenForConcept(context, diagramRelationship.concept && diagramRelationship.concept.id, view.id);
  });
}

function collectElementConcept(context, concept) {
  if(!concept) return;
  if(context.elementsCollection) {
    if(!context.elementsCollection.contains(concept)) context.elementsCollection.add($(concept));
    return;
  }
  context.elementsCollection = $(concept);
}

function collectRelationshipConcept(context, concept) {
  if(!concept) return;
  if(context.relationshipsCollection) {
    if(!context.relationshipsCollection.contains(concept)) context.relationshipsCollection.add($(concept));
    return;
  }
  context.relationshipsCollection = $(concept);
}

function addViewClassTokenForConcept(context, conceptId, viewId) {
  if(!conceptId || !viewId) return;

  var key = String(conceptId);
  var token = getViewDomId(context, viewId);
  var tokens = context.viewClassTokensByConceptId[key];

  if(!tokens) {
    tokens = [];
    context.viewClassTokensByConceptId[key] = tokens;
  }

  if(tokens.indexOf(token) === -1) tokens.push(token);
}

function getViewClassesForConcept(context, conceptId) {
  if(!conceptId) return '';

  var tokens = context.viewClassTokensByConceptId[String(conceptId)];
  if(!tokens || !tokens.length) return '';

  return tokens.join(' ');
}

function buildIndexArtifacts(context) {
  context.globalElementPanelSelector = buildGlobalElementPanelSelector(context, context.elementsCollection);
  context.elementsHtml = buildElementsRows(context);
  context.relationshipsHtml = buildRelationshipsRows(context);
}

function buildElementsRows(context) {
  var parts = [];
  _.chain(context.elementsCollection)
    .sortBy(function(element) { return element.name; })
    .each(function(element) {
      parts.push(context.templates.element({
        viewsIds: getViewClassesForConcept(context, element.id),
        elementName: renderConceptLink(context, element, _.escape(element.name)),
        elementType: properCase(element.type)
      }));
    });
  return parts.join('');
}

function buildRelationshipsRows(context) {
  var parts = [];
  _.chain(context.relationshipsCollection)
    .sortBy(function(relationship) { return relationship.name; })
    .each(function(relationship) {
      parts.push(context.templates.relationship({
        viewsIds: getViewClassesForConcept(context, relationship.id),
        relationshipName: _.escape(relationship.name),
        relationshipType: properCase(relationship.type),
        relationshipSource: renderConceptLink(context, relationship.source, _.escape(relationship.source.name)),
        relationshipTarget: renderConceptLink(context, relationship.target, _.escape(relationship.target.name))
      }));
    });
  return parts.join('');
}

function buildGlobalElementPanelSelector(context, allElements) {
  var panels = '';
  context.elementPanelSelectorByConceptId = {};

  if(allElements) {
    _.chain(allElements)
      .sortBy(function(element) { return element.name; })
      .each(function(element) {
        var selectorId = getElementSelectorDomId(context, element.id);
        context.elementPanelSelectorByConceptId[String(element.id)] = selectorId;

        panels += context.templates.viewElementPanel({
          selectorId: selectorId,
          selectorName: context.globalElementSelectorName,
          noneSelectorId: context.globalElementNoneSelectorId,
          elementName: _.escape(element.name || '(Unnamed)'),
          elementType: properCase(String(element.type || '')),
          elementDocumentationContent: renderElementDocumentationContent(context, element.documentation || ''),
          elementPropertiesContent: renderElementPropertiesContent(element),
          panelTabDocId: context.globalPanelTabDocId,
          panelTabPropsId: context.globalPanelTabPropsId
        });
      });
  }

  return (
    '<div class="view-element-selector">' +
      '<input id="' + context.globalElementNoneSelectorId + '" class="hidden" type="radio" name="' + context.globalElementSelectorName + '" checked>' +
      '<input id="' + context.globalPanelTabDocId + '" class="hidden" type="radio" name="' + context.globalPanelTabName + '" checked>' +
      '<input id="' + context.globalPanelTabPropsId + '" class="hidden" type="radio" name="' + context.globalPanelTabName + '">' +
      panels +
    '</div>'
  );
}

function renderElementDocumentationContent(context, rawDocumentation) {
  return renderDocumentationContent(context, rawDocumentation || '');
}

function renderElementPropertiesContent(concept) {
  var properties = getConceptProperties(concept, _);
  if(!properties.length) return '<p class="view-element-empty">No properties.</p>';

  var rows = [];
  _.each(properties, function(property) {
    rows.push('<tr><td>' + _.escape(property.key) + '</td><td>' + _.escape(property.value).replace(/\n/g, '<br>') + '</td></tr>');
  });

  return '<table class="view-properties-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
}

function renderConceptLink(context, concept, fallbackText) {
  var text = fallbackText || _.escape((concept && concept.name) || '');
  var selectorId = getElementPanelSelectorIdForConcept(context, concept && concept.id);
  if(!selectorId) return text;

  return '<label for="' + _.escape(selectorId) + '" class="pointer clickable-link">' + text + '</label>';
}

function getElementPanelSelectorIdForConcept(context, conceptId) {
  if(!conceptId) return null;
  return context.elementPanelSelectorByConceptId[String(conceptId)] || null;
}
