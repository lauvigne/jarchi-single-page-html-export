## Generate Single-page HTML Export

![image](https://user-images.githubusercontent.com/5757396/79693148-50620700-8269-11ea-9223-b5a384c9421f.png)

Requires [jArchi](https:www.archimatetool.com/blog/2018/07/02/jarchi/)

This script creates a single HTML page which contains views contained into
selected folders. This HTML page makes heavy use of CSS tricks to create
a dynamic web application which doesn't rely on JavaScript.
This non-JS approach is by design to allow the file to be previewed when
stored on Onedrive Pro, MsTeams or SharePoint Document Library.

To use it, simply download the archive from the [latest release](https://github.com/archi-contribs/jarchi-single-page-html-export/releases) and unzip it in your `scripts` folder. Then select one or more folders containing views and run the script through the context menu.

Markdown rendering of documentation is configured at export generation time (profile option) and persisted per model. Only the selected format is emitted in the generated HTML.

## Architecture (current)

The export is now organized around a **view component pipeline**:

1. `buildViewModel(view)` prepares data for one view (id, name, image path, image size, documentation).
2. `renderViewComponent(viewModel)` produces one autonomous HTML component (`templates/view-component.tpl`) including:
   - diagram image
   - hotspots
   - viewRef navigation
   - element detail panels
   - documentation
3. `aggregateRenderedViewComponents(...)` assembles all generated view components and related radio/CSS rules.

### Helper modules in `libs/`

- `libs/hotspot-geometry.js`
  - hotspot geometry/normalization
  - recursive diagram traversal
- `libs/viewref-resolution.js`
  - target view resolution for `archimate-diagram-model` nodes
  - direct candidate resolution + deep fallback + name fallback
- `libs/export-preferences.js`
  - export directory defaults
  - persisted preferences read/write
  - model preference key
  - Archi preference mapping (`SCALE_IMAGE_EXPORT` -> zoom factor)
- `libs/archi-compat.js`
  - compatibility wrappers for Archi API differences between versions
- `libs/template-loader.js`
  - central template compilation and registration

This keeps `Generate Single-page HTML Export.ajs` focused on orchestration and report assembly.

Copyright (c) 2020 Phillip Beauvoir & Jean-Baptiste Sarrodie

>Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:
>
>The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
>
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
