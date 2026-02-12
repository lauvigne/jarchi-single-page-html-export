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

function getDefaultExportProfile(defaultExportDirPath) {
  return {
    directory: String(defaultExportDirPath || ''),
    baseHref: './',
    debugHotspots: false,
    markdownEnabled: true,
    minifyHtmlOutput: true,
    exportStats: false
  };
}

function normalizeBoolean(value, defaultValue) {
  if(value === true || value === false) return value;
  if(typeof value === 'string') {
    var lowered = String(value).trim().toLowerCase();
    if(lowered === 'true') return true;
    if(lowered === 'false') return false;
    if(lowered === '1') return true;
    if(lowered === '0') return false;
    if(lowered === 'yes') return true;
    if(lowered === 'no') return false;
  }
  if(typeof value === 'number') {
    if(value === 1) return true;
    if(value === 0) return false;
  }
  return defaultValue === true;
}

function normalizeBaseHref(value) {
  var baseHref = String(value || '').trim();
  if(!baseHref) baseHref = './';
  if(baseHref.charAt(baseHref.length - 1) !== '/') baseHref += '/';
  return baseHref;
}

function normalizeProfile(profile, defaultProfile) {
  var source = profile || {};
  return {
    directory: String(source.directory || defaultProfile.directory || ''),
    baseHref: normalizeBaseHref(source.baseHref || defaultProfile.baseHref),
    debugHotspots: normalizeBoolean(source.debugHotspots, defaultProfile.debugHotspots),
    markdownEnabled: normalizeBoolean(source.markdownEnabled, defaultProfile.markdownEnabled),
    minifyHtmlOutput: normalizeBoolean(source.minifyHtmlOutput, defaultProfile.minifyHtmlOutput),
    exportStats: normalizeBoolean(source.exportStats, defaultProfile.exportStats)
  };
}

function normalizeModelPreferenceProfiles(modelPreferences, defaultExportDirPath) {
  var defaultProfile = getDefaultExportProfile(defaultExportDirPath);
  var source = modelPreferences || {};
  var normalized = {
    activeProfile: 'default',
    profiles: {
      default: defaultProfile
    }
  };

  // Legacy shape migration: model entry directly stores one profile.
  if(source && source.profiles === undefined) {
    normalized.profiles.default = normalizeProfile(source, defaultProfile);
    normalized.activeProfile = 'default';
    return normalized;
  }

  if(source && source.profiles && typeof source.profiles === 'object') {
    normalized.profiles = {};
    for(var profileName in source.profiles) {
      if(!Object.prototype.hasOwnProperty.call(source.profiles, profileName)) continue;
      var name = String(profileName || '').trim();
      if(!name) continue;
      normalized.profiles[name] = normalizeProfile(source.profiles[profileName], defaultProfile);
    }
    if(!Object.keys(normalized.profiles).length) {
      normalized.profiles.default = defaultProfile;
    }
  }

  var requestedActive = String(source.activeProfile || '').trim();
  if(requestedActive && normalized.profiles[requestedActive]) {
    normalized.activeProfile = requestedActive;
  } else {
    normalized.activeProfile = Object.keys(normalized.profiles)[0];
  }

  return normalized;
}

function promptExportConfigurationDialog(modelName, profileStore) {
  var profileNames = Object.keys(profileStore.profiles || {}).sort();
  if(!profileNames.length) profileNames = ['default'];
  var activeName = profileStore.activeProfile && profileStore.profiles[profileStore.activeProfile]
    ? profileStore.activeProfile
    : profileNames[0];
  var activeProfile = profileStore.profiles[activeName] || getDefaultExportProfile(getDefaultExportDirectoryPath());

  var promptTitle =
    'Export settings (single prompt)\n' +
    'Known profiles: ' + profileNames.join(', ') + '\n' +
    'Edit values below (profile can be existing or new):';
  var defaultText =
    'profile=' + activeName + '\n' +
    'directory=' + String(activeProfile.directory || '') + '\n' +
    'baseHref=' + normalizeBaseHref(activeProfile.baseHref) + '\n' +
    'debugHotspots=' + String(activeProfile.debugHotspots === true) + '\n' +
    'markdownEnabled=' + String(activeProfile.markdownEnabled !== false) + '\n' +
    'minifyHtmlOutput=' + String(activeProfile.minifyHtmlOutput !== false) + '\n' +
    'exportStats=' + String(activeProfile.exportStats === true);

  var input = window.prompt(promptTitle, defaultText);
  if(!input) return null;

  var parsed = parseSinglePromptConfig(String(input));
  if(!parsed) {
    console.log('Invalid configuration format.');
    return null;
  }

  var profileName = String(parsed.profile || activeName || 'default').trim() || 'default';
  var fallbackBase = profileStore.profiles[profileName] || activeProfile;
  var normalized = normalizeProfile(parsed, normalizeProfile(fallbackBase, getDefaultExportProfile(getDefaultExportDirectoryPath())));
  if(!String(normalized.directory || '').trim()) {
    console.log('Directory is required.');
    return null;
  }

  var updatedStore = {
    activeProfile: profileName,
    profiles: {}
  };
  var names = Object.keys(profileStore.profiles || {});
  for(var i = 0; i < names.length; i++) {
    updatedStore.profiles[names[i]] = normalizeProfile(
      profileStore.profiles[names[i]],
      getDefaultExportProfile(normalized.directory)
    );
  }
  updatedStore.profiles[profileName] = normalized;

  return {
    profileName: profileName,
    profile: normalized,
    profileStore: updatedStore
  };
}

function parseSinglePromptConfig(text) {
  var raw = String(text || '').trim();
  if(!raw) return null;

  if(raw.charAt(0) === '{') {
    try {
      return JSON.parse(raw);
    } catch(err) {
      return null;
    }
  }

  var cfg = {};
  var lines = raw.split(/\r?\n/);
  for(var i = 0; i < lines.length; i++) {
    var line = String(lines[i] || '').trim();
    if(!line || line.charAt(0) === '#') continue;
    var eq = line.indexOf('=');
    if(eq <= 0) continue;
    var key = String(line.substring(0, eq)).trim();
    var value = String(line.substring(eq + 1)).trim();
    if(!key) continue;
    cfg[key] = value;
  }
  return cfg;
}
