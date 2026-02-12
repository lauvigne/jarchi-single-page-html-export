// Shared utility helpers

function hasActiveModel(modelRef) {
  try {
    // Accessing CurrentModel properties throws when no model is selected.
    var __activeModelId = modelRef.id;
    return !!__activeModelId;
  }
  catch(err) {
    return false;
  }
}

function ensureActiveModelOrExit(modelRef, message) {
  if(hasActiveModel(modelRef)) return true;
  window.alert(message || 'No active model selected. Open/select a model, then run the export again.');
  exit();
  return false;
}
