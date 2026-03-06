<div id="{{dialogId}}" class="view-object-dialog">
  <a href="#{{viewId}}" class="view-object-dialog-overlay"></a>
  <div class="view-object-dialog-content">
    <header>
      <h3>{{objectName}}</h3>
      <a href="#{{viewId}}" class="close" aria-label="Close">&times;</a>
    </header>
    <section>
      <p class="view-object-type">{{objectType}}</p>
      <h4>Documentation</h4>
      <div class="txt">{{documentationText}}</div>
      <div class="md">{{documentationMarkdown}}</div>
      <h4>Properties</h4>
      <table class="view-object-properties">
        <tbody>
          {{propertiesRows}}
        </tbody>
      </table>
    </section>
  </div>
</div>
