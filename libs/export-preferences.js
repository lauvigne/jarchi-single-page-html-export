// Export preference and path helpers
// This module centralizes persistence and default export path resolution.

function getHotspotZoomFactorFromArchiPreference() {
  try {
    var scaleImageExport = ArchiPlugin.getInstance()
      .getPreferenceStore()
      .getBoolean(IPreferenceConstants.SCALE_IMAGE_EXPORT);
    return scaleImageExport ? 2 : 1;
  }
  catch(err) {
    console.error('impossible to retrieve SCALE_IMAGE_EXPORT pref ! so use zoomFactor to 2');
    return 2;
  }
}

function getDefaultExportDirectoryPath() {
  var exportsRoot = getExportsRootDirectory();
  if(!exportsRoot.exists()) exportsRoot.mkdirs();
  return new File(exportsRoot, sanitizeFileName(String(model.name || 'model'))).getPath();
}

function getExportsRootDirectory() {
  var dataLocation = resolveDataLocationPath();
  if(dataLocation) {
    return new File(dataLocation, 'exports');
  }
  return new File(System.getProperty('user.home'), 'exports');
}

function resolveDataLocationPath() {
  var raw = System.getProperty('data.location');
  if(!raw) return null;
  raw = String(raw).trim();
  if(!raw) return null;

  if(raw.indexOf('@user.home') === 0) {
    raw = System.getProperty('user.home') + raw.substring('@user.home'.length);
  }

  if(raw.indexOf('file:') === 0) {
    try {
      return new File(new URI(raw)).getPath();
    }
    catch(err) {
      return raw.substring('file:'.length);
    }
  }

  return raw;
}

function getExportPreferencesFile() {
  var configArea = resolveConfigurationAreaPath();
  var configDir = configArea ? new File(configArea) : new File(System.getProperty('user.home'));
  if(!configDir.exists()) configDir.mkdirs();
  return new File(configDir, '.exportSinglePage');
}

function resolveConfigurationAreaPath() {
  var raw = System.getProperty('osgi.configuration.area');
  if(!raw) return null;
  raw = String(raw).trim();
  if(!raw) return null;

  if(raw.indexOf('@user.home') === 0) {
    raw = System.getProperty('user.home') + raw.substring('@user.home'.length);
  }

  if(raw.indexOf('file:') === 0) {
    try {
      return new File(new URI(raw)).getPath();
    }
    catch(err) {
      return raw.substring('file:'.length);
    }
  }

  return raw;
}

function readExportPreferences(preferencesFile) {
  try {
    if(preferencesFile && preferencesFile.exists() && preferencesFile.isFile()) {
      var bytes = Files.readAllBytes(Paths.get(preferencesFile.getPath()));
      var content = String(new java.lang.String(bytes, StandardCharsets.UTF_8)).trim();
      if(content) return JSON.parse(content);
    }
  }
  catch(err) {
    console.log('Unable to read export preferences: ', err);
  }
  return {};
}

function writeExportPreferences(preferencesFile, allPreferences) {
  try {
    var parent = preferencesFile.getParentFile();
    if(parent && !parent.exists()) parent.mkdirs();
    Files.write(
      Paths.get(preferencesFile.getPath()),
      JSON.stringify(allPreferences, null, 2).getBytes(StandardCharsets.UTF_8)
    );
  }
  catch(err) {
    console.log('Unable to write export preferences: ', err);
  }
}

function getModelPreferenceKey() {
  if(model && model.id) return 'id:' + String(model.id);
  return 'name:' + String(model.name || 'model');
}

function sanitizeFileName(value) {
  var sanitized = String(value || '').replace(/[\\\/:\*\?"<>\|]/g, '_').trim();
  return sanitized || 'model';
}
