<input id="{{selectorId}}" class="hidden" type="radio" name="{{selectorName}}">
<div class="view-element-panel">
  <label for="{{noneSelectorId}}" class="view-element-panel-close icon close" title="Close"></label>
  <h4>{{elementName}} ({{elementType}})</h4>
  <div class="tabs two view-element-tabs">
    <label for="{{panelTabDocId}}" class="pointer">Documentation</label>
    <label for="{{panelTabPropsId}}" class="pointer">Properties</label>
    <div class="row">
      <div>{{elementDocumentationContent}}</div>
      <div>{{elementPropertiesContent}}</div>
    </div>
  </div>
</div>
