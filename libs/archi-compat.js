// Archi compatibility helpers
// This module isolates version-dependent API calls (Archi 5.4.x vs 5.7.x).

var archiCompatContext = {
  archiPluginClassName: "com.archimatetool.editor.ArchiPlugin",
  preferenceConstantsClassName: "com.archimatetool.editor.preferences.IPreferenceConstants"
};

function getArchiJavaType(className) {
  try {
    return Java.type(className);
  }
  catch(err) {
    return null;
  }
}

function getArchiScaleImageExportPreference() {
  var ArchiPluginClass = getArchiJavaType(archiCompatContext.archiPluginClassName);
  var IPreferenceConstantsClass = getArchiJavaType(archiCompatContext.preferenceConstantsClassName);
  if(!ArchiPluginClass || !IPreferenceConstantsClass) return false;

  var prefKey = IPreferenceConstantsClass.SCALE_IMAGE_EXPORT;

  // Archi 5.4.x compatibility: static accessor.
  try {
    if(ArchiPluginClass.PREFERENCES && typeof ArchiPluginClass.PREFERENCES.getBoolean === 'function') {
      return ArchiPluginClass.PREFERENCES.getBoolean(prefKey) === true;
    }
  }
  catch(errStatic) {}

  // Archi 5.7.x compatibility: instance preference store.
  try {
    if(typeof ArchiPluginClass.getInstance === 'function') {
      var plugin = ArchiPluginClass.getInstance();
      if(plugin && typeof plugin.getPreferenceStore === 'function') {
        var prefStore = plugin.getPreferenceStore();
        if(prefStore && typeof prefStore.getBoolean === 'function') {
          return prefStore.getBoolean(prefKey) === true;
        }
      }
    }
  }
  catch(errInstance) {}

  return false;
}

function isArchiCommandLineApplication() {
  try {
    var SystemClass = Java.type("java.lang.System");
    var appId = String(SystemClass.getProperty("eclipse.application") || "");
    return appId === "com.archimatetool.commandline.app";
  }
  catch(err) {
    return false;
  }
}

function isJavaHeadlessEnvironment() {
  try {
    var GraphicsEnvironment = Java.type("java.awt.GraphicsEnvironment");
    return GraphicsEnvironment.isHeadless() === true;
  }
  catch(err) {
    return false;
  }
}

function isArchiHeadlessMode() {
  return isArchiCommandLineApplication() || isJavaHeadlessEnvironment();
}
