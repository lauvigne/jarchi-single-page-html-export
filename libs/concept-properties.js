// Concept properties helpers
// Isolate dynamic property-shape handling (GraalVM/JArchi proxies can vary by model/type).

function getConceptProperties(concept, underscoreRef) {
  var out = [];
  if(!concept || typeof concept.prop !== 'function') return out;

  var _ref = underscoreRef || _;

  function pushProperty(key, value) {
    var k = String(key || '').trim();
    if(!k) return;
    out.push({
      key: k,
      value: value === null || value === undefined ? '' : String(value)
    });
  }

  function readPropertyValue(conceptRef, key) {
    try {
      return conceptRef.prop(String(key));
    }
    catch(err) {
      return '';
    }
  }

  var props = null;
  try {
    props = concept.prop();
  }
  catch(err) {
    return out;
  }
  if(!props) return out;

  try {
    // 1) Collection-like array of keys
    if(Array.isArray(props)) {
      _ref.each(props, function(key) {
        if(key === null || key === undefined) return;
        pushProperty(key, readPropertyValue(concept, key));
      });
    }
    // 2) jArchi collection exposing each(value, key)
    else if(typeof props.each === 'function') {
      props.each(function(value, key) {
        if(key === undefined || key === null) {
          pushProperty(value, readPropertyValue(concept, value));
        }
        else {
          pushProperty(key, value);
        }
      });
    }
    // 3) Java Map-like shape
    else if(typeof props.entrySet === 'function') {
      var entries = props.entrySet();
      if(entries && typeof entries.iterator === 'function') {
        var it = entries.iterator();
        while(it && it.hasNext()) {
          var entry = it.next();
          pushProperty(entry.getKey(), entry.getValue());
        }
      }
    }
    // 4) Java Collection-like keys
    else if(typeof props.iterator === 'function') {
      var keyIt = props.iterator();
      while(keyIt && keyIt.hasNext()) {
        var key = keyIt.next();
        pushProperty(key, readPropertyValue(concept, key));
      }
    }
    // 5) Plain object fallback
    else if(typeof props === 'object') {
      for(var key in props) {
        if(Object.prototype.hasOwnProperty.call(props, key)) {
          pushProperty(key, props[key]);
        }
      }
    }
  }
  catch(err) {
    // Keep tolerant behavior: ignore unsupported proxy operations.
  }

  var uniq = {};
  var deduped = [];
  _ref.each(out, function(p) {
    var id = p.key + '::' + p.value;
    if(uniq[id]) return;
    uniq[id] = true;
    deduped.push(p);
  });

  return _ref.sortBy(deduped, function(p) {
    return p.key.toLowerCase();
  });
}
