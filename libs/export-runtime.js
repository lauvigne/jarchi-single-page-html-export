// Export runtime/orchestration helpers
// Build context, resolve output destination, initialize export dependencies.

var File = Java.type('java.io.File');

function initializeConsole() {
  if(isArchiHeadlessMode()) return;
  console.show();
  console.clear();
}

function createExportContext() {
  var rootDir = EXPORT_SCRIPT_ROOT;
  var context = {
    modelName: String(model.name || ''),
    templates: loadCompiledTemplates(_, rootDir),
    styles: {
      roboto: readFully(rootDir + 'resources/roboto.css', 'UTF-8'),
      icon: readFully(rootDir + 'resources/icon.css', 'UTF-8'),
      picnic: readFully(rootDir + 'resources/picnic-custom.css', 'UTF-8')
    },
    markdownOptions: {
      gfm: true,
      breaks: true,
      smartLists: true,
      smartypants: true
    },
    markdownEnabled: true,
    minifyHtmlOutputEnabled: true,
    hotspotZoomFactor: getHotspotZoomFactorFromArchiPreference(),

    folders: selectVisibleFolders(),

    preferencesFile: getExportPreferencesFile(),
    allPreferences: null,
    modelPreferenceKey: null,
    profileStore: null,
    exportDestinationError: '',

    exportDirectory: null,
    imagesDirectory: null,
    indexFilePath: '',
    baseHref: './',
    sharepointUrl: '',
    topBannerMessage: '',

    // Aggregation state
    treeContent: '',
    viewComponents: [],
    viewComponentsHtml: '',
    visibilityRulesBoldParts: [],
    visibilityRulesRevealParts: [],
    visibilityRulesRevealBlockParts: [],
    inputCheckboxParts: [],

    elementsCollection: null,
    relationshipsCollection: null,
    elementsHtml: '',
    relationshipsHtml: '',
    globalElementPanelSelector: '',

    // Cross-reference state
    viewClassTokensByConceptId: {},
    elementPanelSelectorByConceptId: {},

    // DOM id shortener state
    domIdMap: {},
    domIdCounter: 0,

    // Global panel selectors
    globalElementSelectorName: 'selected-element-global',
    globalElementNoneSelectorId: 'selected-element-none-global',
    globalPanelTabName: 'selected-element-panel-tab',
    globalPanelTabDocId: 'selected-element-panel-tab-doc',
    globalPanelTabPropsId: 'selected-element-panel-tab-props',

    // Views root marker
    viewsRootFolderId: null,

    // Diagnostics
    exportIssues: [],
    errorCount: 0,
    warningCount: 0
  };

  initializeProfileStore(context);
  initializeViewsRootMarker(context);

  return context;
}

function selectVisibleFolders() {
  var allFolders = $('folder');
  var viewsFolder = $(model).children().filter('folder.Views');
  var viewFolders = viewsFolder.find('folder');
  var nonViewFolders = allFolders.not(viewsFolder).not(viewFolders);

  var selectedFolders = selection.filter('folder').not(nonViewFolders);
  selectedFolders = selectedFolders.filter(function(folder) { return !isHiddenFromExport(folder); });

  if(!selectedFolders.size()) {
    selectedFolders = viewsFolder.filter(function(folder) { return !isHiddenFromExport(folder); });
    console.log('All visible views have been selected.');
  }

  return selectedFolders;
}

function initializeProfileStore(context) {
  context.allPreferences = readExportPreferences(context.preferencesFile);
  context.modelPreferenceKey = getModelPreferenceKey();

  var rawModelPreferences = getModelExportPreferences(context.allPreferences, context.modelPreferenceKey);
  var defaultExportDirPath = getDefaultExportDirectoryPath();
  context.profileStore = normalizeModelPreferenceProfiles(rawModelPreferences, defaultExportDirPath);
}

function initializeViewsRootMarker(context) {
  var viewsFolder = $(model).children().filter('folder.Views');
  var viewsRootFolder = viewsFolder && viewsFolder.first ? viewsFolder.first() : null;
  context.viewsRootFolderId = viewsRootFolder ? String(viewsRootFolder.id) : null;
}

function initializeHotspotRuntime(context) {
  initHotspotGeometry({
    _: _,
    tplViewHotspotCompact: function() { return context.templates.viewHotspotCompact; },
    getViewDomId: function(rawViewId) { return getViewDomId(context, rawViewId); },
    getElementSelectorDomId: function(rawConceptId) { return getElementSelectorDomId(context, rawConceptId); },
    getDiagramNodeHotspotTarget: getDiagramNodeHotspotTarget,
    isViewReferenceDiagramType: isViewReferenceDiagramType
  });
}

function resolveExportDestination(context) {
  context.exportDestinationError = '';
  var selectedProfile = resolveSelectedExportProfile(context);
  if(!selectedProfile) {
    if(!context.exportDestinationError) context.exportDestinationError = 'User cancelled.';
    return false;
  }
  return prepareExportDestination(context, selectedProfile);
}

function resolveSelectedExportProfile(context) {
  var exportConfig = resolveExportConfiguration(model.name, context.profileStore);
  if(!exportConfig) {
    context.exportDestinationError = 'User cancelled.';
    return null;
  }

  context.profileStore = exportConfig.profileStore;
  return exportConfig.profile;
}

function prepareExportDestination(context, selectedProfile) {
  context.markdownEnabled = selectedProfile.markdownEnabled !== false;
  context.minifyHtmlOutputEnabled = selectedProfile.minifyHtmlOutput !== false;
  context.topBannerMessage = String(selectedProfile.bannerMessage || '');
  var normalizedBaseHref = normalizeBaseHref(selectedProfile.baseHref);
  var normalizedSharepointUrl = String(selectedProfile.sharepointUrl || '').trim();
  context.baseHref = normalizedBaseHref;
  context.sharepointUrl = normalizedSharepointUrl;

  var resolvedExportDirPath = resolveExportDirectoryPath(context, selectedProfile.directory);
  var exportDirectory = new File(resolvedExportDirPath).getAbsoluteFile();

  if(!exportDirectory.exists()) exportDirectory.mkdirs();
  if(!exportDirectory.isDirectory()) {
    context.exportDestinationError = 'Export directory is invalid: ' + resolvedExportDirPath;
    console.log(context.exportDestinationError);
    return false;
  }

  context.exportDirectory = exportDirectory;
  context.imagesDirectory = new File(exportDirectory, 'images');
  if(!context.imagesDirectory.exists()) context.imagesDirectory.mkdirs();

  context.profileStore.profiles[context.profileStore.activeProfile].directory = exportDirectory.getPath();
  context.profileStore.profiles[context.profileStore.activeProfile].baseHref = normalizedBaseHref;
  context.profileStore.profiles[context.profileStore.activeProfile].sharepointUrl = normalizedSharepointUrl;
  context.profileStore.profiles[context.profileStore.activeProfile].bannerMessage = context.topBannerMessage;

  context.indexFilePath = new File(exportDirectory, 'index.html').getPath();

  var preferencesWriteKey = getExportPreferencesWriteKey(context.allPreferences, context.modelPreferenceKey);
  context.allPreferences[preferencesWriteKey] = context.profileStore;
  writeExportPreferences(context.preferencesFile, context.allPreferences);

  return true;
}

function resolveExportDirectoryPath(context, exportDirPath) {
  var directory = String(exportDirPath || '');
  var exportDirFile = new File(directory);
  if(exportDirFile.isAbsolute()) return directory;

  var prefsParent = context.preferencesFile && context.preferencesFile.getParentFile ? context.preferencesFile.getParentFile() : null;
  if(!prefsParent) return directory;

  return new File(prefsParent, directory).getPath();
}
