// Shared utility helpers

function alert(message) {
  var msg = String(message || '');
  try {
    if(typeof window !== 'undefined' && window && typeof window.alert === 'function') {
      window.alert(msg);
    }
    else {
      console.log(msg);
    }
  }
  catch(err) {
    console.log(msg);
  }
}

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
  var msg = message || 'No active model selected. Open/select a model, then run the export again.';
  alert(msg);
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

function isHiddenFromExport(obj) {
  if(!obj || typeof obj.prop !== 'function') return false;
  var raw = null;
  try {
    raw = obj.prop('_hide_from_export_');
  }
  catch(err) {
    return false;
  }
  return parseExportFlag(raw) === true;
}

function parseExportFlag(value) {
  if(value === true) return true;
  if(value === false || value === null || value === undefined) return false;
  if(typeof value === 'number') return value === 1;
  var lowered = String(value).trim().toLowerCase();
  return lowered === 'true' || lowered === '1' || lowered === 'yes';
}
