// Template loading helpers
// Centralizes template compilation so the main script stays focused on export flow.

function loadCompiledTemplates(underscoreLib, rootDir) {
  var compile = underscoreLib.template;
  var readTemplate = function(relativePath) {
    return readFully(rootDir + relativePath, 'UTF-8');
  };

  return {
    mainReport: compile(readTemplate('templates/main-report.html')),
    visibilityRuleBold: compile(readTemplate('templates/visibility-rule-bold.tpl')),
    visibilityRuleReveal: compile(readTemplate('templates/visibility-rule-reveal.tpl')),
    visibilityRuleRevealBlock: compile(readTemplate('templates/visibility-rule-reveal-block.tpl')),
    inputCheckbox: compile(readTemplate('templates/input-checkbox.tpl')),
    treeView: compile(readTemplate('templates/model-tree-view.tpl')),
    treeFolder: compile(readTemplate('templates/model-tree-folder.tpl')),
    viewHotspotCompact: compile(readTemplate('templates/view-hotspot-compact.tpl')),
    viewComponent: compile(readTemplate('templates/view-component.tpl')),
    viewElementPanel: compile(readTemplate('templates/view-element-panel.tpl')),
    element: compile(readTemplate('templates/element.tpl')),
    relationship: compile(readTemplate('templates/relationship.tpl'))
  };
}
