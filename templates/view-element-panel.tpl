<input id="{{selectorId}}" class="hidden" type="radio" name="{{selectorName}}">
<div class="view-element-panel">
  <label for="{{noneSelectorId}}" class="view-element-panel-close icon close" title="Close"></label>
  <h4>{{elementName}} <span class="element-type-muted">({{elementType}})</span></h4>
  <input id="{{panelTabDocId}}" class="hidden view-panel-tab-doc" type="radio" name="{{panelTabName}}" checked>
  <input id="{{panelTabPropsId}}" class="hidden view-panel-tab-props" type="radio" name="{{panelTabName}}">
  <div class="tabs two view-element-tabs">
    <label for="{{panelTabDocId}}" class="pointer">Documentation</label>
    <label for="{{panelTabPropsId}}" class="pointer">Properties</label>
    <div class="row">
      <div>{{elementDocumentationContent}}</div>
      <div>{{elementPropertiesContent}}</div>
    </div>
  </div>
</div>
