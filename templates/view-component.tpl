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
    {{documentationContent}}
  </div>
</article>
