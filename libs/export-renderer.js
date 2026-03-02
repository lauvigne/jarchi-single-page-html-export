// Export rendering helpers
// Traverse selected folders/views and render final single-page HTML report.

var File = Java.type('java.io.File');
var ImageIO = Java.type('javax.imageio.ImageIO');

function exportSelectedViews(context) {
  _.chain(context.folders)
    .sortBy(function(folder) { return folder.name; })
    .each(function(folder) { exportFolderTree(context, folder); });

  aggregateRenderedViewComponents(context);
}

function exportFolderTree(context, folder) {
  if(isHiddenFromExport(folder)) {
    console.log('Skipping hidden folder "', folder.name, '" (_hide_from_export_=true)');
    return;
  }

  console.log('Exporting "', folder.name, '"...');

  var previousContent = context.treeContent;
  var isViewsRootFolder = context.viewsRootFolderId && String(folder.id) === context.viewsRootFolderId;
  context.treeContent = '';

  _.chain($(folder).children('folder').filter(function(childFolder) { return !isHiddenFromExport(childFolder); }))
    .sortBy(function(childFolder) { return childFolder.name; })
    .each(function(childFolder) { exportFolderTree(context, childFolder); });

  _.chain($(folder).children('view').filter(function(view) { return !isHiddenFromExport(view); }))
    .sortBy(function(view) { return view.name; })
    .each(function(view) {
      try {
        var viewModel = buildViewModel(context, view);
        var renderedComponent = renderViewComponent(context, viewModel);

        context.viewComponents.push(renderedComponent);
        context.treeContent += renderedComponent.treeItem;
        recordViewConcepts(context, view);
      }
      catch(err) {
        addExportIssue(
          context,
          'error',
          'render-view',
          'Failed to export view "' + String(view.name || '(Unnamed)') + '" (' + String(view.id || '') + ')',
          err
        );
      }
    });

  if(!isViewsRootFolder) {
    context.treeContent = context.templates.treeFolder({
      folderId: getFolderDomId(context, folder.id),
      folderName: _.escape(folder.name),
      folderContent: context.treeContent
    });
  }

  context.treeContent = previousContent + context.treeContent;
}

function buildViewModel(context, view) {
  var viewId = getViewDomId(context, view.id);
  var viewImagePath = normalizeBaseHref(context.baseHref) + 'images/' + view.id + '.png';
  var viewImageFile = new File(context.imagesDirectory, view.id + '.png');

  try {
    $.model.renderViewToFile(view, viewImageFile.getPath(), 'PNG');
  }
  catch(err) {
    throw new Error(
      'renderViewToFile failed for view "' + String(view.name || '(Unnamed)') + '" (' + String(view.id || '') + ')' +
      ': ' + toErrorMessage(err)
    );
  }

  if(!viewImageFile.exists()) {
    throw new Error(
      'renderViewToFile produced no output file for view "' + String(view.name || '(Unnamed)') + '" (' +
      String(view.id || '') + ') at ' + viewImageFile.getPath()
    );
  }

  return {
    rawView: view,
    viewId: viewId,
    viewName: _.escape(view.name),
    viewImagePath: viewImagePath,
    viewImageSize: readImageSize(viewImageFile),
    documentationContent: renderDocumentationContent(context, view.documentation || '')
  };
}

function renderViewComponent(context, viewModel) {
  var viewInteraction = buildViewInteraction(viewModel.rawView, viewModel.viewImageSize, context.hotspotZoomFactor);

  return {
    treeItem: context.templates.treeView({
      viewId: viewModel.viewId,
      viewName: viewModel.viewName
    }),
    visibilityBoldRule: context.templates.visibilityRuleBold({ viewId: viewModel.viewId }),
    visibilityRevealRule: context.templates.visibilityRuleReveal({ viewId: viewModel.viewId }),
    visibilityRevealBlockRule: context.templates.visibilityRuleRevealBlock({ viewId: viewModel.viewId }),
    inputCheckbox: context.templates.inputCheckbox({ viewId: viewModel.viewId }),
    viewComponent: context.templates.viewComponent({
      viewId: viewModel.viewId,
      viewName: viewModel.viewName,
      viewImagePath: viewModel.viewImagePath,
      viewHotspots: viewInteraction.hotspots,
      viewPanels: viewInteraction.panels,
      documentationContent: viewModel.documentationContent
    })
  };
}

function aggregateRenderedViewComponents(context) {
  var viewComponentParts = [];
  _.each(context.viewComponents, function(component) {
    context.visibilityRulesBoldParts.push(component.visibilityBoldRule);
    context.visibilityRulesRevealParts.push(component.visibilityRevealRule);
    context.visibilityRulesRevealBlockParts.push(component.visibilityRevealBlockRule);
    context.inputCheckboxParts.push(component.inputCheckbox);
    viewComponentParts.push(component.viewComponent);
  });
  context.viewComponentsHtml = viewComponentParts.join('');
}

function writeHtmlReport(context) {
  var htmlReport = context.templates.mainReport({
    roboto: context.minifyHtmlOutputEnabled ? minifyCssText(context.styles.roboto) : context.styles.roboto,
    icon: context.minifyHtmlOutputEnabled ? minifyCssText(context.styles.icon) : context.styles.icon,
    picnic: context.minifyHtmlOutputEnabled ? minifyCssText(context.styles.picnic) : context.styles.picnic,
    baseHref: _.escape(context.baseHref),
    topSnackbar: renderTopSnackbar(context.topBannerMessage, context.sharepointUrl),
    modelTitle: _.escape(context.modelName),
    visibilityRulesBold: context.visibilityRulesBoldParts.join(''),
    visibilityRulesReveal: context.visibilityRulesRevealParts.join(''),
    visibilityRulesRevealBlock: context.visibilityRulesRevealBlockParts.join(''),
    inputCheckbox: context.inputCheckboxParts.join(''),
    treeContent: context.treeContent,
    viewComponents: context.viewComponentsHtml,
    globalElementPanelSelector: context.globalElementPanelSelector,
    modelPurposeContent: renderDocumentationContent(context, model.purpose || ''),
    elements: context.elementsHtml,
    relationships: context.relationshipsHtml,
    sidebarBgColor: '#37474f',
    sidebarColor: '#DDDDDD',
    sidebarWidth: '350px',
    sidebarMargin: '10px',
    sidebarFooterHeight: '0px',
    headerHeight: '60px',
    headerBgColor: '#0074D9',
    headerColor: '#fff',
    mainBgColor: '#fff',
    mainColor: '#000',
    mainMargin: '20px',
    mainHeaderMargin: '35px',
    mainHeaderBgColor: '#eceff1',
    mainHeaderColor: '#546e7a',
    treeMargin: '1.3em'
  });

  if(context.minifyHtmlOutputEnabled) {
    htmlReport = minifyInlineCssBlocks(htmlReport);
    htmlReport = minifyGeneratedHtml(htmlReport);
  }

  try {
    $.fs.writeFile(context.indexFilePath, htmlReport, 'UTF-8');
  }
  catch(err) {
    throw new Error('Unable to write HTML report at "' + String(context.indexFilePath || '') + '": ' + toErrorMessage(err));
  }
}

function renderDocumentationContent(context, rawDocumentation) {
  if(!rawDocumentation || !String(rawDocumentation).trim()) return '';

  var escaped = _.escape(rawDocumentation || '');
  if(context.markdownEnabled) {
    return '<div class="md">' + marked(escaped, context.markdownOptions) + '</div>';
  }
  return '<div class="txt">' + escaped.replace(/\n/g, '<br>') + '</div>';
}

function renderTopSnackbar(rawMessage, rawBaseHref) {
  var message = String(rawMessage || '').trim();
  if(!message) return '';

  var href = String(rawBaseHref || '').trim();
  var output = '<input id="top-snackbar-dismiss" class="hidden" type="checkbox">' +
    '<div class="top-snackbar">' +
    '<span class="top-snackbar-msg">' + _.escape(message) + '</span>';

  if(href) {
    output += '<a class="top-snackbar-url" href="' + _.escape(href) + '" target="_blank" rel="noopener noreferrer">' + _.escape(href) + '</a>';
  }

  output += '<label for="top-snackbar-dismiss" class="top-snackbar-close" title="Close">×</label></div>';
  return output;
}

function minifyGeneratedHtml(html) {
  return String(html || '')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function minifyInlineCssBlocks(html) {
  return String(html || '').replace(/<style>([\s\S]*?)<\/style>/g, function(_match, css) {
    return '<style>' + minifyCssText(css) + '</style>';
  });
}

function readImageSize(imageFile) {
  try {
    if(!imageFile || !imageFile.exists()) return null;
    var image = ImageIO.read(imageFile);
    if(!image) return null;

    return {
      width: Number(image.getWidth()),
      height: Number(image.getHeight())
    };
  }
  catch(err) {
    console.log('Unable to read image size for view export: ', err);
    return null;
  }
}
