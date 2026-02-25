// Export preference and path helpers
// This module centralizes persistence and default export path resolution.

var File = Java.type('java.io.File');
var Files = Java.type('java.nio.file.Files');
var Paths = Java.type('java.nio.file.Paths');
var StandardCharsets = Java.type('java.nio.charset.StandardCharsets');
var System = Java.type('java.lang.System');
var URI = Java.type('java.net.URI');

function getHotspotZoomFactorFromArchiPreference() {
  var scaleImageExport = getArchiScaleImageExportPreference();
  return scaleImageExport === true ? 2 : 1;
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
  var overridePath = getRequestedExportPreferencesFilePath();
  if(overridePath) {
    return new File(overridePath).getAbsoluteFile();
  }

  var configArea = resolveConfigurationAreaPath();
  var configDir = configArea ? new File(configArea) : new File(System.getProperty('user.home'));
  if(!configDir.exists()) configDir.mkdirs();
  return new File(configDir, '.exportSinglePage');
}

function getRequestedExportPreferencesFilePath() {
  var raw = System.getProperty('export.preferencesFilePath');
  if(raw === null || raw === undefined) raw = System.getProperty('export.preferencesFile');
  if(raw === null || raw === undefined) raw = System.getenv('EXPORT_PREFERENCES_FILE_PATH');
  if(raw === null || raw === undefined) raw = System.getenv('EXPORT_PREFERENCES_FILE');
  if(raw === null || raw === undefined) return null;
  var path = String(raw).trim();
  return path ? path : null;
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

function getModelExportPreferences(allPreferences, modelPreferenceKey) {
  var hasExternalPreferencesFile = !!getRequestedExportPreferencesFilePath();
  if(hasExternalPreferencesFile && allPreferences && allPreferences.__default__) {
    return allPreferences.__default__;
  }
  if(allPreferences && allPreferences[modelPreferenceKey]) {
    return allPreferences[modelPreferenceKey];
  }
  if(allPreferences && allPreferences.__default__) {
    return allPreferences.__default__;
  }
  return {};
}

function getExportPreferencesWriteKey(allPreferences, modelPreferenceKey) {
  var hasExternalPreferencesFile = !!getRequestedExportPreferencesFilePath();
  if(hasExternalPreferencesFile && allPreferences && allPreferences.__default__) {
    return '__default__';
  }
  return modelPreferenceKey;
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
    sharepointUrl: '',
    bannerMessage: '',
    markdownEnabled: true,
    minifyHtmlOutput: true
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
    sharepointUrl: String(source.sharepointUrl || defaultProfile.sharepointUrl || '').trim(),
    bannerMessage: String(source.bannerMessage || defaultProfile.bannerMessage || ''),
    markdownEnabled: normalizeBoolean(source.markdownEnabled, defaultProfile.markdownEnabled),
    minifyHtmlOutput: normalizeBoolean(source.minifyHtmlOutput, defaultProfile.minifyHtmlOutput)
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

function getActiveProfileName(profileStore) {
  var names = Object.keys(profileStore.profiles || {});
  if(!names.length) return 'default';
  if(profileStore.activeProfile && profileStore.profiles[profileStore.activeProfile]) {
    return profileStore.activeProfile;
  }
  return names[0];
}

function getRequestedExportProfileName() {
  var raw = System.getProperty('export.profileName');
  if(raw === null || raw === undefined) raw = System.getProperty('export.profile');
  if(raw === null || raw === undefined) raw = System.getenv('EXPORT_PROFILE_NAME');
  if(raw === null || raw === undefined) raw = System.getenv('EXPORT_PROFILE');
  if(raw === null || raw === undefined) return null;
  var profileName = String(raw).trim();
  return profileName ? profileName : null;
}

function resolveExportConfiguration(modelName, profileStore) {
  var requestedProfileName = getRequestedExportProfileName();
  if(requestedProfileName) {
    if(profileStore.profiles && profileStore.profiles[requestedProfileName]) {
      profileStore.activeProfile = requestedProfileName;
      console.log('Requested export profile: "' + requestedProfileName + '".');
    }
    else {
      console.log('Requested export profile "' + requestedProfileName + '" was not found.');
      return null;
    }
  }

  if(isArchiHeadlessMode()) {
    var headlessProfileName = getActiveProfileName(profileStore);
    var headlessProfile = profileStore.profiles[headlessProfileName] || getDefaultExportProfile(getDefaultExportDirectoryPath());
    console.log('Headless mode detected: using export profile "' + headlessProfileName + '".');
    return {
      profileName: headlessProfileName,
      profile: normalizeProfile(headlessProfile, getDefaultExportProfile(getDefaultExportDirectoryPath())),
      profileStore: profileStore
    };
  }

  return promptExportConfigurationDialog(modelName, profileStore);
}

function promptExportConfigurationDialog(modelName, profileStore) {
  ensureCreateDialogLibraryLoaded();

  var profileNames = Object.keys(profileStore.profiles || {}).sort();
  if(!profileNames.length) profileNames = ['default'];
  var activeName = profileStore.activeProfile && profileStore.profiles[profileStore.activeProfile]
    ? profileStore.activeProfile
    : profileNames[0];
  var activeProfile = profileStore.profiles[activeName] || getDefaultExportProfile(getDefaultExportDirectoryPath());

  function applyProfileToDialog(dialogLayout, profile) {
    if(!dialogLayout || !dialogLayout.properties || !profile) return;
    var props = dialogLayout.properties;
    function setText(name, value) {
      var widget = props[name] && props[name].widget;
      if(widget && typeof widget.setText === 'function') widget.setText(String(value || ''));
    }
    function setChecked(name, value) {
      var widget = props[name] && props[name].widget;
      if(widget && typeof widget.setSelection === 'function') widget.setSelection(value === true);
    }

    setText('directory', profile.directory);
    setText('baseHref', normalizeBaseHref(profile.baseHref));
    setText('sharepointUrl', profile.sharepointUrl || '');
    setText('bannerMessage', profile.bannerMessage || '');
    setChecked('markdownEnabled', profile.markdownEnabled !== false);
    setChecked('minifyHtmlOutput', profile.minifyHtmlOutput !== false);
  }

  var dialog = createDialog(
    {
      type: 'form',
      title: 'Single-page HTML Export',
      message: 'Configuration profile for "' + String(modelName || 'model') + '"',
      columns: 2,
      properties: {
        profile: {
          type: 'combo',
          label: 'Profile',
          values: profileNames,
          value: activeName,
          extend: true,
          tooltip: 'Choose an existing profile or type a new one and press Enter',
          selection: function(_property, widget, dialogLayout) {
            var selectedName = String(widget.getText() || '').trim();
            var selectedProfile = profileStore.profiles[selectedName];
            if(!selectedProfile) return false;
            applyProfileToDialog(dialogLayout, selectedProfile);
            return true;
          }
        },
        directory: {
          type: 'text',
          label: 'Export directory',
          value: String(activeProfile.directory || ''),
          fill: true
        },
        baseHref: {
          type: 'text',
          label: 'Base href',
          value: normalizeBaseHref(activeProfile.baseHref),
          fill: true
        },
        sharepointUrl: {
          type: 'text',
          label: 'SharePoint URL',
          value: String(activeProfile.sharepointUrl || ''),
          fill: true
        },
        bannerMessage: {
          type: 'text',
          label: 'Top banner',
          value: String(activeProfile.bannerMessage || ''),
          fill: true
        },
        markdownEnabled: {
          type: 'checkbox',
          label: 'Markdown',
          message: 'Render documentation as Markdown',
          value: activeProfile.markdownEnabled !== false
        },
        minifyHtmlOutput: {
          type: 'checkbox',
          label: 'Minify',
          message: 'Minify generated HTML output',
          value: activeProfile.minifyHtmlOutput !== false
        }
      }
    },
    {
      dialogType: 'titleAndDialog',
      width: 760,
      height: 420
    }
  );

  if(!dialog.open()) return null;

  var values = dialog.dialogResult || {};
  var profileName = String(values.profile || activeName || 'default').trim() || 'default';
  var profileBase = profileStore.profiles[profileName] || activeProfile;
  var normalized = normalizeProfile(
    values,
    normalizeProfile(profileBase, getDefaultExportProfile(getDefaultExportDirectoryPath()))
  );

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

function ensureCreateDialogLibraryLoaded() {
  if(typeof createDialog === 'function') return;

  var file = new File(__DIR__ + 'CreateEclipseForm.js');
  if(!file.exists() || !file.isFile()) {
    throw new Error('CreateDialog library not found: ' + file.getAbsolutePath());
  }
  load(file.getAbsolutePath());
  if(typeof createDialog !== 'function') {
    throw new Error('CreateDialog did not initialize correctly from: ' + file.getAbsolutePath());
  }
}
