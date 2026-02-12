<article class="hidden view-component {{viewId}}">
  <h2>{{viewName}}</h2>
  <!-- Diagram image with absolute-positioned hotspot overlay -->
  <div class="view-diagram-block">
    <div class="view-diagram-container">
      <img class="diagram-image" src="{{viewImagePath}}" loading="lazy" decoding="async" fetchpriority="low">
      <div class="view-diagram-overlay">
        {{viewHotspots}}
      </div>
    </div>
  </div>
  <div class="view-component-body">
    <!-- Markdown/plain text rendering toggled globally by #markdown -->
    <div class="txt">{{documentationText}}</div>
    <div class="md">{{documentationMarkdown}}</div>
    <!-- Per-view element detail selector (radio-group scoped by viewSelectorName) -->
    <div class="view-element-selector">
      <input id="{{viewNoneSelectorId}}" class="hidden" type="radio" name="{{viewSelectorName}}" checked>
      <div class="view-element-panel">
        <h4>Element details</h4>
        <p>Select an element in the diagram.</p>
      </div>
      {{viewElementPanels}}
    </div>
  </div>
</article>
