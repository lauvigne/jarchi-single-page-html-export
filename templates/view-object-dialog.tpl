<div id="{{dialogId}}" class="view-object-dialog">
  <label for="{{dialogNoneSelectorId}}" class="view-object-dialog-overlay"></label>
  <div class="view-object-dialog-content">
    <header>
      <h3>{{objectName}}</h3>
      <label for="{{dialogNoneSelectorId}}" class="close" aria-label="Close">&times;</label>
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
