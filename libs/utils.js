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

function properCase(str) {
  return String(str || '').replace(
    /\w*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  ).replace('-', ' ');
}

function minifyCssText(css) {
  return String(css || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBase36(n) {
  return Number(n).toString(36);
}

function toNumber(value) {
  var n = Number(value);
  if(isNaN(n)) return null;
  return n;
}

function toInt(value) {
  var n = Number(value);
  if(isNaN(n)) return 0;
  if(n < 0) return Math.ceil(n);
  return Math.floor(n);
}

function clampPercent(v) {
  if(v < 0) return 0;
  if(v > 100) return 100;
  return v;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
