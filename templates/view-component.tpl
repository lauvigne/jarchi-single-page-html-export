<article class="hidden view-component {{viewId}}">
  <h2>{{viewName}}</h2>
  <!-- Diagram image with absolute-positioned hotspot overlay -->
  <div class="view-diagram-block">
    <div class="view-diagram-container">
      <img class="diagram-image" src="{{viewImagePath}}" loading="lazy" decoding="async" fetchpriority="low">
      <div class="view-image-script-bounds">
        <span class="view-image-script-bounds-label">script(raw): {{viewImageWidth}}x{{viewImageHeight}} | zoom={{viewZoomFactor}} | script(norm): {{viewImageZoomedWidth}}x{{viewImageZoomedHeight}}</span>
      </div>
      <div class="view-diagram-overlay">
        {{viewHotspots}}
      </div>
    </div>
  </div>
  <div class="view-component-body">
    {{documentationContent}}
  </div>
</article>
