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

var __exportDebugEnabled = null;
function isExportDebugEnabled() {
  if(__exportDebugEnabled !== null) return __exportDebugEnabled;
  try {
    var SystemClass = Java.type('java.lang.System');
    var raw = SystemClass.getProperty('export.debug');
    if(raw === null || raw === undefined) raw = SystemClass.getenv('EXPORT_DEBUG');
    __exportDebugEnabled = parseExportFlag(raw);
  }
  catch(err) {
    __exportDebugEnabled = false;
  }
  return __exportDebugEnabled;
}

function toErrorMessage(err) {
  if(err === null || err === undefined) return 'Unknown error';
  try {
    if(typeof err.getMessage === 'function') {
      var javaMsg = String(err.getMessage() || '').trim();
      if(javaMsg) return javaMsg;
    }
  }
  catch(ignoreJavaMessage) {}
  try {
    var text = String(err).trim();
    return text || 'Unknown error';
  }
  catch(ignoreToString) {
    return 'Unknown error';
  }
}

function toErrorStack(err) {
  if(err === null || err === undefined) return '';
  try {
    if(err.stack) return String(err.stack);
  }
  catch(ignoreJsStack) {}
  try {
    if(typeof err.getStackTrace === 'function') {
      var stack = err.getStackTrace();
      if(stack && typeof stack.length === 'number') {
        var out = [];
        for(var i = 0; i < stack.length; i++) out.push(String(stack[i]));
        return out.join('\n');
      }
    }
  }
  catch(ignoreJavaStack) {}
  return '';
}

function logWarn(message, err) {
  var output = '[WARN] ' + String(message || '');
  if(err) output += ' :: ' + toErrorMessage(err);
  console.log(output);
  if(err && isExportDebugEnabled()) {
    var stack = toErrorStack(err);
    if(stack) console.log(stack);
  }
}

function logError(message, err) {
  var output = '[ERROR] ' + String(message || '');
  if(err) output += ' :: ' + toErrorMessage(err);
  console.log(output);
  if(err) {
    var stack = toErrorStack(err);
    if(stack) console.log(stack);
  }
}

function addExportIssue(context, severity, stage, label, err) {
  if(!context) return;
  if(!context.exportIssues) context.exportIssues = [];

  var normalizedSeverity = String(severity || 'error').toLowerCase();
  var issue = {
    severity: normalizedSeverity,
    stage: String(stage || ''),
    label: String(label || ''),
    message: toErrorMessage(err)
  };
  context.exportIssues.push(issue);

  if(normalizedSeverity === 'warning') {
    context.warningCount = Number(context.warningCount || 0) + 1;
    logWarn('[' + issue.stage + '] ' + issue.label, err);
    return;
  }

  context.errorCount = Number(context.errorCount || 0) + 1;
  logError('[' + issue.stage + '] ' + issue.label, err);
}

function printExportIssueSummary(context) {
  if(!context) return;
  var errorCount = Number(context.errorCount || 0);
  var warningCount = Number(context.warningCount || 0);
  var total = errorCount + warningCount;
  if(!total) {
    console.log('Export diagnostics: no warnings or errors.');
    return;
  }

  console.log('Export diagnostics: ' + errorCount + ' error(s), ' + warningCount + ' warning(s).');
  var issues = context.exportIssues || [];
  for(var index = 0; index < issues.length; index++) {
    var issue = issues[index];
    var line = '[' + String(issue.severity || 'error').toUpperCase() + ']';
    if(issue.stage) line += ' [' + issue.stage + ']';
    if(issue.label) line += ' ' + issue.label;
    if(issue.message) line += ' :: ' + issue.message;
    console.log((index + 1) + '. ' + line);
  }
}

function resolveModuleFunction(moduleRef, candidates, moduleLabel) {
  if(typeof moduleRef === 'function') return moduleRef;

  var names = candidates && candidates.length ? candidates : [];
  for(var i = 0; i < names.length; i++) {
    var name = names[i];
    if(moduleRef && typeof moduleRef[name] === 'function') {
      return moduleRef[name];
    }
  }

  var label = String(moduleLabel || 'module');
  var expected = ['default function export'];
  for(var j = 0; j < names.length; j++) expected.push('module.' + names[j] + ' function');
  throw new Error('Unsupported ' + label + ' module shape. Expected ' + expected.join(', ') + '.');
}
