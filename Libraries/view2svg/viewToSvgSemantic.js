(function() {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.viewToSvgSemantic !== "undefined") {
        return;
    }

    function withDefaults(options) {
        var opts = options || {};
        return {
            margin: typeof opts.margin === "number" ? opts.margin : 12,
            fontFamily: opts.fontFamily || "ArchiCustom, Arial, sans-serif",
            fontSize: typeof opts.fontSize === "number" ? opts.fontSize : 12,
            fontWeight: opts.fontWeight || "normal",
            fontStyle: opts.fontStyle || "normal",
            fontFaceFamily: opts.fontFaceFamily || "ArchiCustom",
            fontFaceUrl: opts.fontFaceUrl || "",
            fontFaceFormat: opts.fontFaceFormat || "woff2",
            backgroundColor: opts.backgroundColor || "#ffffff",
            useDiagramPreferences: opts.useDiagramPreferences !== false,
            diagramPreferences: opts.diagramPreferences || null,
            wordWrapStyle: opts.wordWrapStyle || null
        };
    }

    function escapeXml(value) {
        if (value == null) return "";
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    function escapeAttr(value) {
        return escapeXml(value).replaceAll("\"", "&quot;");
    }

    function toNumber(value, fallback) {
        return (typeof value === "number" && !isNaN(value)) ? value : fallback;
    }

    function toNumberLike(value, fallback) {
        if (typeof value === "number" && !isNaN(value)) return value;
        if (typeof value === "string") {
            var trimmed = value.trim();
            if (trimmed.length === 0) return fallback;
            var parsed = Number(trimmed);
            if (!isNaN(parsed)) return parsed;
        }
        return fallback;
    }

    function safeColor(value, fallback) {
        return value ? String(value) : fallback;
    }

    function parseLineWidth(value, fallback) {
        var v = toNumber(value, fallback);
        if (!isFinite(v) || v <= 0) return fallback;
        return v;
    }

    function parseOpacityField(rawValue) {
        var value = toNumberLike(rawValue, NaN);
        if (!isFinite(value)) return null;
        if (value >= 0 && value <= 1) return Math.max(0, Math.min(1, value));
        if (value > 1 && value <= 100) return Math.max(0, Math.min(1, 1 - (value / 100)));
        if (value > 100 && value <= 255) return Math.max(0, Math.min(1, value / 255));
        return Math.max(0, Math.min(1, value));
    }

    function parseLineStyleDashArray(lineStyle) {
        var style = lineStyle;
        if (style === null || style === undefined) return "";
        var n = toNumber(style, NaN);
        if (isFinite(n)) {
            if (n === 0) return "";
            if (n === 1) return "6 4";
            if (n === 2) return "2 3";
            return "6 4";
        }
        var s = String(style).toLowerCase();
        if (s.indexOf("dash") >= 0) return "6 4";
        if (s.indexOf("dot") >= 0) return "2 3";
        return "";
    }

    function safeString(value) {
        if (value === null || value === undefined) return "";
        return String(value);
    }

    function safeCall(object, methodName, fallback) {
        try {
            if (object && typeof object[methodName] === "function") {
                var value = object[methodName]();
                return value === undefined ? fallback : value;
            }
        } catch (e) {
            // ignore and fallback
        }
        return fallback;
    }

    function safeProp(object, key, fallback) {
        try {
            if (object && typeof object.prop === "function") {
                var v = object.prop(key);
                return v === undefined || v === null ? fallback : v;
            }
        } catch (e) {
            // ignore
        }
        return fallback;
    }

    function inferMimeTypeFromPath(path) {
        var s = safeString(path).toLowerCase();
        if (s.indexOf(".png") >= 0) return "image/png";
        if (s.indexOf(".jpg") >= 0 || s.indexOf(".jpeg") >= 0) return "image/jpeg";
        if (s.indexOf(".gif") >= 0) return "image/gif";
        if (s.indexOf(".webp") >= 0) return "image/webp";
        if (s.indexOf(".svg") >= 0) return "image/svg+xml";
        return "application/octet-stream";
    }

    function mapToJsObject(javaMap) {
        if (!javaMap) return null;
        try {
            var out = {};
            var it = javaMap.entrySet().iterator();
            while (it.hasNext()) {
                var e = it.next();
                out[safeString(e.getKey())] = e.getValue();
            }
            return out;
        } catch (e) {
            return null;
        }
    }

    function filePathFromHref(href) {
        var s = safeString(href).trim();
        if (!s) return "";
        if (s.indexOf("file://") === 0) return s.substring("file://".length);
        if (s[0] === "/") return s;
        try {
            var Paths = Java.type("java.nio.file.Paths");
            var Files = Java.type("java.nio.file.Files");

            // 1) relative to model file folder (Archi stores note images in model-side "images/" folder)
            var modelPath = null;
            modelPath = safeCall($.model, "getFile", null) || safeCall($.model, "getPath", null) || safeCall($.model, "getFilePath", null);
            if (!modelPath) {
                try { modelPath = $.model.file; } catch (e0) {}
            }
            if (modelPath) {
                var modelDir = Paths.get(String(modelPath)).getParent();
                if (modelDir) {
                    var p1 = modelDir.resolve(s).normalize();
                    if (Files.exists(p1)) return p1.toString();
                }
            }

            // 2) relative to current script directory if available
            if (typeof __DIR__ !== "undefined" && __DIR__) {
                var p2 = Paths.get(String(__DIR__), s).normalize();
                if (Files.exists(p2)) return p2.toString();
            }

            // 3) as-is relative to process cwd
            var p3 = Paths.get(s).normalize();
            if (Files.exists(p3)) return p3.toString();
        } catch (e) {
            // ignore
        }
        return "";
    }

    function resolveRelativeImageHref(href, object, opts) {
        var s = safeString(href).trim();
        if (!s) return "";
        if (s.indexOf("data:") === 0 || s.indexOf("http://") === 0 || s.indexOf("https://") === 0 || s.indexOf("file://") === 0 || s[0] === "/") {
            return s;
        }
        try {
            var Paths = Java.type("java.nio.file.Paths");
            var Files = Java.type("java.nio.file.Files");
            var File = Java.type("java.io.File");

            function asFileUriIfExists(baseDir, rel) {
                if (!baseDir) return "";
                var p = Paths.get(String(baseDir)).resolve(rel).normalize();
                if (Files.exists(p)) return "file://" + p.toString();
                return "";
            }

            function findByFileName(rootDir, fileName, maxDepth) {
                try {
                    if (!rootDir || !fileName) return "";
                    var rootPath = Paths.get(String(rootDir)).normalize();
                    if (!Files.exists(rootPath)) return "";
                    var stream = Files.find(rootPath, maxDepth || 4, Java.type("java.util.function.BiPredicate")({
                        test: function(path, attrs) {
                            return attrs.isRegularFile() && safeString(path.getFileName().toString()) === fileName;
                        }
                    }));
                    try {
                        var it = stream.iterator();
                        if (it.hasNext()) return "file://" + it.next().toString();
                    } finally {
                        stream.close();
                    }
                } catch (eFind) {
                    // ignore
                }
                return "";
            }

            // 1) relative to model file directory (best candidate for Archi note images folder)
            var modelPath = null;
            modelPath = safeCall($.model, "getFile", null) || safeCall($.model, "getPath", null) || safeCall($.model, "getFilePath", null);
            if (!modelPath) {
                try { modelPath = $.model.file; } catch (e0) {}
            }
            if (!modelPath && object && object.eObject) {
                try {
                    var uri = object.eObject.eResource().getURI();
                    if (uri && uri.toFileString) modelPath = uri.toFileString();
                } catch (e1) {
                    // ignore
                }
            }
            if (modelPath) {
                var modelDir = Paths.get(String(modelPath)).getParent();
                var resolvedFromModel = asFileUriIfExists(modelDir, s);
                if (resolvedFromModel) return resolvedFromModel;
            }

            // 2) relative to export SVG destination directory
            if (opts && opts._exportFilePath) {
                var exportDir = Paths.get(String(opts._exportFilePath)).getParent();
                var resolvedFromExport = asFileUriIfExists(exportDir, s);
                if (resolvedFromExport) return resolvedFromExport;
            }

            // 3) relative to script dir
            if (typeof __DIR__ !== "undefined" && __DIR__) {
                var resolvedFromScript = asFileUriIfExists(__DIR__, s);
                if (resolvedFromScript) return resolvedFromScript;
            }

            // 4) fallback search by filename in probable roots
            var fileName = safeString(new File(s).getName());
            if (fileName) {
                if (modelPath) {
                    var modelDir2 = Paths.get(String(modelPath)).getParent();
                    var foundModel = findByFileName(modelDir2, fileName, 6);
                    if (foundModel) return foundModel;
                }
                if (opts && opts._exportFilePath) {
                    var exportDir2 = Paths.get(String(opts._exportFilePath)).getParent();
                    var foundExport = findByFileName(exportDir2, fileName, 6);
                    if (foundExport) return foundExport;
                }
                if (typeof __DIR__ !== "undefined" && __DIR__) {
                    var foundScript = findByFileName(__DIR__, fileName, 6);
                    if (foundScript) return foundScript;
                }
                var foundCwd = findByFileName(".", fileName, 4);
                if (foundCwd) return foundCwd;
            }
        } catch (e) {
            // ignore
        }
        return s;
    }

    function inlineImageHref(href) {
        var s = safeString(href).trim();
        if (!s) return "";
        if (s.indexOf("data:") === 0 || s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return s;
        var path = filePathFromHref(s);
        if (!path) return s;
        try {
            var Files = Java.type("java.nio.file.Files");
            var Paths = Java.type("java.nio.file.Paths");
            var Base64 = Java.type("java.util.Base64");
            var bytes = Files.readAllBytes(Paths.get(path));
            var b64 = Base64.getEncoder().encodeToString(bytes);
            return "data:" + inferMimeTypeFromPath(path) + ";base64," + b64;
        } catch (e) {
            return s;
        }
    }

    function hashString(str) {
        var s = safeString(str);
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        return (h >>> 0).toString(16);
    }

    function ensureImageSymbol(href, opts) {
        if (!opts) return null;
        if (!opts._imageSymbolByHref) opts._imageSymbolByHref = {};
        if (!opts._imageDefs) opts._imageDefs = [];

        var inlined = inlineImageHref(href);
        if (!inlined) return null;
        if (opts._imageSymbolByHref[inlined]) return opts._imageSymbolByHref[inlined];

        var id = "imgdef-" + hashString(inlined);
        opts._imageSymbolByHref[inlined] = id;
        opts._imageDefs.push(
            '<symbol id="' + id + '" viewBox="0 0 1 1" preserveAspectRatio="none">' +
            '<image x="0" y="0" width="1" height="1" href="' + escapeAttr(inlined) + '" xlink:href="' + escapeAttr(inlined) + '" preserveAspectRatio="none"/>' +
            "</symbol>"
        );
        return id;
    }

    function resolveFontStyleAndWeight(fontStyleRaw, defaultStyle, defaultWeight) {
        var style = defaultStyle || "normal";
        var weight = defaultWeight || "normal";

        var n = toNumber(fontStyleRaw, NaN);
        if (isFinite(n)) {
            if (n === 1) weight = "bold";
            if (n === 2) style = "italic";
            if (n === 3) {
                style = "italic";
                weight = "bold";
            }
            return { style: style, weight: weight };
        }

        var s = safeString(fontStyleRaw).toLowerCase();
        if (s.indexOf("italic") >= 0) style = "italic";
        if (s.indexOf("bold") >= 0) weight = "bold";
        return { style: style, weight: weight };
    }

    function mergeFontFallbacks(primaryFamily, fallbackFamily) {
        var parts = [];
        function addPart(value) {
            var s = safeString(value).trim();
            if (!s) return;
            s.split(",").forEach(function(token) {
                var t = token.trim();
                if (!t) return;
                if (parts.indexOf(t) < 0) parts.push(t);
            });
        }
        addPart(primaryFamily);
        addPart(fallbackFamily);
        addPart("Apple Color Emoji");
        addPart("Segoe UI Emoji");
        addPart("Noto Color Emoji");
        addPart("Segoe UI Symbol");
        addPart("sans-serif");
        return parts.join(", ");
    }

    function getTextStyleForObject(object, opts, defaults) {
        var d = defaults || {};
        var defaultColor = d.color || "#222";
        var defaultSize = toNumber(d.size, opts.fontSize);

        var fontColor = safeColor(object.fontColor, defaultColor);
        var fontName = safeString(safeCall(object, "getFontName", null)).trim();
        var fontFamily = fontName ? mergeFontFallbacks(fontName, opts.fontFamily) : mergeFontFallbacks(opts.fontFamily, "");
        var fontSize = toNumber(safeCall(object, "getFontSize", NaN), NaN);
        if (!isFinite(fontSize) || fontSize <= 0) fontSize = defaultSize;
        var styleWeight = resolveFontStyleAndWeight(
            safeCall(object, "getFontStyle", null),
            opts.fontStyle,
            opts.fontWeight
        );

        return {
            color: fontColor,
            family: fontFamily,
            size: fontSize,
            style: styleWeight.style,
            weight: styleWeight.weight
        };
    }

    function resolveLabel(object) {
        return object.labelValue ? object.labelValue :
            object.name ? object.name : safeString(object.text);
    }

    function normalizeImageHref(raw) {
        if (raw && typeof raw === "object") return "";
        var s = safeString(raw).trim();
        if (!s) return "";
        if (s === "[object Object]") return "";
        if (s.indexOf("data:") === 0 || s.indexOf("http://") === 0 || s.indexOf("https://") === 0 || s.indexOf("file://") === 0) {
            return s;
        }
        if (s[0] === "/") return "file://" + s;
        if (s.indexOf(".png") >= 0 || s.indexOf(".jpg") >= 0 || s.indexOf(".jpeg") >= 0 || s.indexOf(".gif") >= 0 || s.indexOf(".webp") >= 0 || s.indexOf(".svg") >= 0) {
            return s;
        }
        return s;
    }

    function imageObjectToDataUri(imageObj) {
        try {
            if (!imageObj || typeof Java === "undefined") return "";

            // Some jArchi note images are exposed as java.util.HashMap
            // containing path/url/base64/bytes metadata.
            var maybeMap = mapToJsObject(imageObj);
            if (maybeMap) {
                var hrefFromMap =
                    normalizeImageHref(maybeMap.path) ||
                    normalizeImageHref(maybeMap.file) ||
                    normalizeImageHref(maybeMap.uri) ||
                    normalizeImageHref(maybeMap.url) ||
                    normalizeImageHref(maybeMap.href) ||
                    normalizeImageHref(maybeMap.src);
                if (hrefFromMap) {
                    var inlinedFromMap = inlineImageHref(hrefFromMap);
                    if (inlinedFromMap) return inlinedFromMap;
                }

                var b64 = safeString(maybeMap.base64 || maybeMap.dataBase64 || maybeMap.contentBase64).trim();
                if (b64) {
                    var mime = safeString(maybeMap.mimeType || maybeMap.mime || maybeMap.contentType).trim() || "image/png";
                    return "data:" + mime + ";base64," + b64;
                }

                var bytesObj = maybeMap.bytes || maybeMap.data || maybeMap.content;
                if (bytesObj) {
                    try {
                        var Base64Map = Java.type("java.util.Base64");
                        var b64Bytes = Base64Map.getEncoder().encodeToString(bytesObj);
                        var mimeBytes = safeString(maybeMap.mimeType || maybeMap.mime || maybeMap.contentType).trim() || "image/png";
                        return "data:" + mimeBytes + ";base64," + b64Bytes;
                    } catch (eMapBytes) {
                        // continue on SWT path
                    }
                }
            }

            var imageData = null;

            function resolveImageData(obj) {
                if (!obj) return null;
                var d = null;
                d = safeCall(obj, "getImageData", null);
                if (!d) d = safeCall(obj, "getImageDataAtCurrentZoom", null);
                if (!d) d = safeCall(obj, "getData", null);
                if (!d) {
                    try { d = obj.getImageData(100); } catch (e0) {}
                }
                if (!d) {
                    try { d = obj.imageData; } catch (e1) {}
                }
                if (!d) {
                    try { d = obj.data; } catch (e2) {}
                }
                return d;
            }

            imageData = resolveImageData(imageObj);
            if (!imageData) {
                var createdImage = safeCall(imageObj, "createImage", null);
                if (!createdImage) {
                    try { createdImage = imageObj.createImage(true); } catch (e3) {}
                }
                imageData = resolveImageData(createdImage);
            }
            if (!imageData) return "";

            var ImageLoader = Java.type("org.eclipse.swt.graphics.ImageLoader");
            var SWT = Java.type("org.eclipse.swt.SWT");
            var ByteArrayOutputStream = Java.type("java.io.ByteArrayOutputStream");
            var Base64 = Java.type("java.util.Base64");
            var loader = new ImageLoader();
            try {
                loader.data = Java.to([imageData], Java.type("org.eclipse.swt.graphics.ImageData[]"));
            } catch (e4) {
                try {
                    loader.data = Java.to([imageData], "org.eclipse.swt.graphics.ImageData[]");
                } catch (e5) {
                    loader.data = [imageData];
                }
            }
            var baos = new ByteArrayOutputStream();
            loader.save(baos, SWT.IMAGE_PNG);
            var b64 = Base64.getEncoder().encodeToString(baos.toByteArray());
            return "data:image/png;base64," + b64;
        } catch (e) {
            return "";
        }
    }

    function getNoteImageSpec(object, opts) {
        if (!object || safeString(object.type).toLowerCase() !== "diagram-model-note") return null;
        var base64FromModel = null;
        try {
            base64FromModel = $.model.saveImageToBase64(object);
        } catch (e0) {
            base64FromModel = null;
        }

        var imageObject =
            object.image ||
            safeCall(object, "getImage", null) ||
            safeProp(object, "image", null);
        var hrefRaw =
            object.imagePath ||
            object.imageSource ||
            safeCall(object, "getImagePath", null) ||
            safeCall(object, "getImageSource", null) ||
            safeProp(object, "imagePath", null) ||
            safeProp(object, "imageSource", null);
        var href = normalizeImageHref(hrefRaw);
        // ignore numeric sentinel values like -1 used by Archi enums.
        if (href === "-1") href = "";
        href = resolveRelativeImageHref(href, object, opts);
        if (!href) {
            var b64 = safeString(base64FromModel).trim();
            if (b64) {
                href = "data:image/png;base64," + b64;
            }
        }
        if (!href) {
            href = imageObjectToDataUri(imageObject);
        }
        if (!href) return null;

        var posRaw =
            object.imagePosition ||
            safeCall(object, "getImagePosition", null) ||
            safeProp(object, "imagePosition", null) ||
            "top-left";

        var size = 16;
        try {
            var imageData = safeCall(imageObject, "getImageData", null) || safeCall(imageObject, "getData", null) || imageObject.imageData || imageObject.data;
            var w = toNumberLike(imageData && imageData.width, NaN);
            var h = toNumberLike(imageData && imageData.height, NaN);
            if (isFinite(w) && isFinite(h) && w > 0 && h > 0) size = Math.max(8, Math.min(64, Math.round(Math.min(w, h))));
        } catch (e) {
            // keep default
        }

        return {
            href: href,
            position: safeString(posRaw).toLowerCase(),
            size: size
        };
    }

    function resolveNoteImageBox(bounds, position, sizeHint) {
        var size = toNumberLike(sizeHint, NaN);
        if (!isFinite(size) || size <= 0) size = 16;
        var pad = 4;
        var x = bounds.x + pad;
        var y = bounds.y + pad;
        var p = safeString(position);
        var n = toNumberLike(p, NaN);

        if (p.indexOf("top-left") >= 0 || p.indexOf("left-top") >= 0 || n === 0) {
            x = bounds.x;
            y = bounds.y + pad;
        } else if (p.indexOf("top-center") >= 0 || p.indexOf("top-middle") >= 0 || n === 1) {
            x = bounds.x + (bounds.width - size) / 2;
            y = bounds.y + pad;
        } else if (p.indexOf("top-right") >= 0 || p.indexOf("right-top") >= 0 || n === 2) {
            x = bounds.x + bounds.width - size;
            y = bounds.y + pad;
        } else if (p.indexOf("middle-left") >= 0 || p.indexOf("left-middle") >= 0 || n === 3) {
            x = bounds.x;
            y = bounds.y + (bounds.height - size) / 2;
        } else if (p.indexOf("middle-center") >= 0 || p.indexOf("center") >= 0 || p.indexOf("middle") >= 0 || n === 4) {
            x = bounds.x + (bounds.width - size) / 2;
            y = bounds.y + (bounds.height - size) / 2;
        } else if (p.indexOf("middle-right") >= 0 || p.indexOf("right-middle") >= 0 || n === 5) {
            x = bounds.x + bounds.width - size;
            y = bounds.y + (bounds.height - size) / 2;
        } else if (p.indexOf("bottom-left") >= 0 || p.indexOf("left-bottom") >= 0 || n === 6) {
            x = bounds.x;
            y = bounds.y + bounds.height - size - pad;
        } else if (p.indexOf("bottom-center") >= 0 || p.indexOf("bottom-middle") >= 0 || n === 7) {
            x = bounds.x + (bounds.width - size) / 2;
            y = bounds.y + bounds.height - size - pad;
        } else if (p.indexOf("bottom-right") >= 0 || p.indexOf("right-bottom") >= 0 || n === 8) {
            x = bounds.x + bounds.width - size;
            y = bounds.y + bounds.height - size - pad;
        }

        return { x: Math.round(x), y: Math.round(y), width: size, height: size };
    }

    function splitLabelLines(label) {
        return safeString(label).replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
    }

    function renderMultilineText(x, y, label, attrs, lineHeight) {
        var lines = splitLabelLines(label).filter(function(line) { return line.length > 0; });
        if (!lines.length) return "";

        var out = '<text x="' + x + '" y="' + y + '"' + (attrs ? (" " + attrs) : "") + ">";
        for (var i = 0; i < lines.length; i++) {
            var dy = i === 0 ? 0 : lineHeight;
            out += '<tspan x="' + x + '" dy="' + dy + '">' + escapeXml(lines[i]) + "</tspan>";
        }
        out += "</text>";
        return out;
    }

    function toSafeIdFragment(value) {
        return safeString(value).replace(/[^A-Za-z0-9_-]/g, "_");
    }

    function normalizeWordWrapStyle(raw) {
        var n = toNumberLike(raw, NaN);
        if (isFinite(n)) {
            if (n === 0) return "hard";
            if (n === 1) return "soft";
            if (n === 2) return "truncated";
        }
        var s = safeString(raw).toLowerCase();
        if (s.indexOf("hard") >= 0) return "hard";
        if (s.indexOf("trunc") >= 0) return "truncated";
        return "soft";
    }

    function estimateMaxChars(widthPx, fontSizePx) {
        var charWidth = Math.max(4, fontSizePx * 0.56);
        return Math.max(1, Math.floor(widthPx / charWidth));
    }

    function wrapHard(line, maxChars) {
        var out = [];
        var s = safeString(line);
        for (var i = 0; i < s.length; i += maxChars) {
            out.push(s.substring(i, i + maxChars));
        }
        return out.length ? out : [""];
    }

    function wrapSoft(line, maxChars) {
        var text = safeString(line);
        if (text.length <= maxChars) return [text];
        var words = text.split(/\s+/);
        var lines = [];
        var current = "";
        words.forEach(function(word) {
            if (!current) {
                if (word.length > maxChars) {
                    wrapHard(word, maxChars).forEach(function(part) { lines.push(part); });
                } else {
                    current = word;
                }
                return;
            }
            if ((current + " " + word).length <= maxChars) {
                current += " " + word;
            } else {
                lines.push(current);
                if (word.length > maxChars) {
                    wrapHard(word, maxChars).forEach(function(part) { lines.push(part); });
                    current = "";
                } else {
                    current = word;
                }
            }
        });
        if (current) lines.push(current);
        return lines.length ? lines : [text];
    }

    function wrapTruncated(line, maxChars) {
        var text = safeString(line);
        if (text.length <= maxChars) return [text];
        if (maxChars <= 1) return ["…"];
        return [text.substring(0, maxChars - 1) + "…"];
    }

    function applyWordWrap(lines, style, maxChars) {
        var out = [];
        lines.forEach(function(line) {
            if (style === "hard") {
                wrapHard(line, maxChars).forEach(function(part) { out.push(part); });
            } else if (style === "truncated") {
                wrapTruncated(line, maxChars).forEach(function(part) { out.push(part); });
            } else {
                wrapSoft(line, maxChars).forEach(function(part) { out.push(part); });
            }
        });
        return out;
    }

    function readPreferenceSummary(opts) {
        if (opts.diagramPreferences) return opts.diagramPreferences;
        if (!opts.useDiagramPreferences) return {};
        if (typeof globalThis !== "undefined" && globalThis.diagramAppearancePrefs) {
            var collected = safeCall(function() { return globalThis.diagramAppearancePrefs.collect({ maxDepth: 6 }); }, null);
            if (collected) {
                var summary = safeCall(function() { return globalThis.diagramAppearancePrefs.summarize(collected); }, {}) || {};
                if (opts.wordWrapStyle != null) summary.wordWrapStyle = opts.wordWrapStyle;
                return summary;
            }
        }
        return opts.wordWrapStyle != null ? { wordWrapStyle: opts.wordWrapStyle } : {};
    }

    function resolveNodeTextAlignment(object, preferenceSummary) {
        var raw = "";
        if (object.textAlignment != null) raw = String(object.textAlignment).toLowerCase();
        else if (object.prop && object.prop("textAlignment") != null) raw = String(object.prop("textAlignment")).toLowerCase();
        else if (preferenceSummary && preferenceSummary.textAlignment != null) raw = String(preferenceSummary.textAlignment).toLowerCase();

        var n = toNumberLike(raw, NaN);
        if (isFinite(n)) {
            if (n === 2) return "center";
            if (n === 4) return "right";
            return "left";
        }
        if (raw.indexOf("center") >= 0 || raw.indexOf("middle") >= 0) return "center";
        if (raw.indexOf("right") >= 0 || raw.indexOf("end") >= 0) return "right";
        return "left";
    }

    function resolveNodeTextVerticalPosition(object, preferenceSummary) {
        var raw = "";
        if (object.textPosition != null) raw = String(object.textPosition).toLowerCase();
        else if (object.labelPosition != null) raw = String(object.labelPosition).toLowerCase();
        else if (object.prop && object.prop("textPosition") != null) raw = String(object.prop("textPosition")).toLowerCase();
        else if (preferenceSummary && preferenceSummary.textPosition != null) raw = String(preferenceSummary.textPosition).toLowerCase();
        else if (preferenceSummary && preferenceSummary.labelPosition != null) raw = String(preferenceSummary.labelPosition).toLowerCase();

        var n = toNumberLike(raw, NaN);
        if (isFinite(n)) {
            if (n === 1) return "middle";
            if (n === 2) return "bottom";
            return "top";
        }
        if (raw.indexOf("middle") >= 0 || raw.indexOf("center") >= 0) return "middle";
        if (raw.indexOf("bottom") >= 0 || raw.indexOf("target") >= 0) return "bottom";
        return "top";
    }

    function resolveBorderVisible(object) {
        return object.type === "diagram-model-note" || object.type === "diagram-model-group" ? object.borderType !== 2 : true;
    }

    function getBoundsWithOffset(element, parentX, parentY) {
        var b = element.bounds;
        if (!b) return null;
        var x = toNumber(b.x, 0) + parentX;
        var y = toNumber(b.y, 0) + parentY;
        var width = toNumber(b.width, 0);
        var height = toNumber(b.height, 0);
        return { x: x, y: y, width: width, height: height };
    }

    function collectViewObjectsRecursively(container, parentX, parentY, outElements, outAll) {
        var children = $(container).children();
        if (!children) return;

        children.each(function(object) {
            outAll.push(object);

            var bounds = getBoundsWithOffset(object, parentX, parentY);
            if (bounds) {
                outElements.push({
                    object: object,
                    bounds: bounds
                });
                collectViewObjectsRecursively(object, bounds.x, bounds.y, outElements, outAll);
            } else {
                collectViewObjectsRecursively(object, parentX, parentY, outElements, outAll);
            }
        });
    }

    function computeCanvas(elements, margin) {
        if (!elements.length) {
            return { x: 0, y: 0, width: 100, height: 100 };
        }

        var minX = elements[0].bounds.x;
        var minY = elements[0].bounds.y;
        var maxX = elements[0].bounds.x + elements[0].bounds.width;
        var maxY = elements[0].bounds.y + elements[0].bounds.height;

        elements.forEach(function(entry) {
            minX = Math.min(minX, entry.bounds.x);
            minY = Math.min(minY, entry.bounds.y);
            maxX = Math.max(maxX, entry.bounds.x + entry.bounds.width);
            maxY = Math.max(maxY, entry.bounds.y + entry.bounds.height);
        });

        return {
            x: Math.floor(minX - margin),
            y: Math.floor(minY - margin),
            width: Math.ceil((maxX - minX) + margin * 2),
            height: Math.ceil((maxY - minY) + margin * 2)
        };
    }

    function buildElementCenterMap(elements) {
        var centers = {};
        elements.forEach(function(entry) {
            centers[entry.object.id] = {
                x: entry.bounds.x + entry.bounds.width / 2,
                y: entry.bounds.y + entry.bounds.height / 2
            };
        });
        return centers;
    }

    function buildElementBoundsMap(elements) {
        var boundsById = {};
        elements.forEach(function(entry) {
            boundsById[entry.object.id] = entry.bounds;
        });
        return boundsById;
    }

    function point(x, y) {
        return { x: x, y: y };
    }

    function pointFromAny(value) {
        if (!value) return null;
        if (typeof value.x === "number" && typeof value.y === "number") {
            return point(value.x, value.y);
        }
        if (typeof value.getX === "function" && typeof value.getY === "function") {
            return point(toNumber(value.getX(), NaN), toNumber(value.getY(), NaN));
        }
        return null;
    }

    function centerOfRect(rect) {
        return point(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }

    function anchorOnRectToward(rect, towardPoint) {
        var cx = rect.x + rect.width / 2;
        var cy = rect.y + rect.height / 2;
        var dx = towardPoint.x - cx;
        var dy = towardPoint.y - cy;

        if (dx === 0 && dy === 0) return point(cx, cy);

        var halfW = rect.width / 2;
        var halfH = rect.height / 2;
        var tx = dx === 0 ? Infinity : halfW / Math.abs(dx);
        var ty = dy === 0 ? Infinity : halfH / Math.abs(dy);
        var t = Math.min(tx, ty);

        return point(cx + dx * t, cy + dy * t);
    }

    function renderFontFaceStyle(opts) {
        if (!opts.fontFaceUrl) return "";
        return "@font-face{" +
            "font-family:'" + escapeAttr(opts.fontFaceFamily) + "';" +
            "src:url('" + escapeAttr(opts.fontFaceUrl) + "') format('" + escapeAttr(opts.fontFaceFormat) + "');" +
            "font-style:" + escapeAttr(opts.fontStyle) + ";" +
            "font-weight:" + escapeAttr(opts.fontWeight) + ";" +
            "}";
    }

    function renderSemanticStyles(opts) {
        var fontFace = renderFontFaceStyle(opts);
        return "<style><![CDATA[" +
            fontFace +
            ".archi-node rect{vector-effect:non-scaling-stroke;}" +
            ".archi-relationship path{fill:none;stroke:#666;stroke-width:1.2;vector-effect:non-scaling-stroke;}" +
            "]]></style>";
    }

    function renderNode(entry, opts, preferenceSummary) {
        var object = entry.object;
        var b = entry.bounds;
        var label = resolveLabel(object);
        var fill = safeColor(object.fillColor, "#f5f5f5");
        var stroke = safeColor(object.lineColor, "#7d7d7d");
        var textStyle = getTextStyleForObject(object, opts, { color: "#222", size: opts.fontSize });
        var lineWidth = parseLineWidth(object.lineWidth, 1);
        var dashArray = parseLineStyleDashArray(object.lineStyle);
        var fillOpacity = parseOpacityField(object.fillOpacity != null ? object.fillOpacity : object.opacity);
        var strokeOpacity = parseOpacityField(object.outlineOpacity);
        var borderVisible = resolveBorderVisible(object);
        if (!borderVisible) {
            stroke = "none";
            lineWidth = 0;
            dashArray = "";
            strokeOpacity = null;
        }
        var rounded = Math.min(12, Math.max(0, Math.floor(Math.min(b.width, b.height) * 0.1)));
        var lineHeight = Math.max(12, Math.floor(textStyle.size * 1.2));
        var baseLines = splitLabelLines(label).filter(function(line) { return line.length > 0; });
        var wrapStyle = normalizeWordWrapStyle(preferenceSummary && preferenceSummary.wordWrapStyle != null ? preferenceSummary.wordWrapStyle : "soft");
        var maxChars = estimateMaxChars(Math.max(16, b.width - 16), textStyle.size);
        var lines = applyWordWrap(baseLines, wrapStyle, maxChars);
        var lineCount = lines.length;
        var blockHeight = textStyle.size + Math.max(0, (lineCount - 1) * lineHeight);
        var alignH = resolveNodeTextAlignment(object, preferenceSummary);
        var alignV = resolveNodeTextVerticalPosition(object, preferenceSummary);
        var labelX = b.x + 8;
        var textAnchor = "start";
        if (alignH === "center") {
            labelX = b.x + (b.width / 2);
            textAnchor = "middle";
        } else if (alignH === "right") {
            labelX = b.x + b.width - 8;
            textAnchor = "end";
        }
        var labelY = b.y + textStyle.size + 6;
        if (alignV === "middle") {
            labelY = b.y + ((b.height - blockHeight) / 2) + textStyle.size;
        } else if (alignV === "bottom") {
            labelY = b.y + b.height - blockHeight + textStyle.size - 6;
        }

        var style = {
            fill: fill,
            stroke: stroke,
            lineWidth: lineWidth,
            dash: dashArray,
            opacityAttrs:
                (fillOpacity !== null ? (' fill-opacity="' + fillOpacity + '"') : "") +
                (strokeOpacity !== null ? (' stroke-opacity="' + strokeOpacity + '"') : "")
        };

        var shapeSvg = '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.width + '" height="' + b.height + '" rx="' + rounded + '" ry="' + rounded + '" fill="' + escapeAttr(fill) + '" stroke="' + escapeAttr(stroke) + '" stroke-width="' + lineWidth + '"' +
            (fillOpacity !== null ? (' fill-opacity="' + fillOpacity + '"') : "") +
            (strokeOpacity !== null ? (' stroke-opacity="' + strokeOpacity + '"') : "") +
            (dashArray ? (' stroke-dasharray="' + dashArray + '"') : "") + '/>';
        var iconSvg = "";
        if (typeof globalThis !== "undefined" && globalThis.archiFigureLibrary) {
            var figureRender = globalThis.archiFigureLibrary.renderNodeFigure(object, b, style, {});
            if (figureRender && figureRender.shapeSvg) shapeSvg = figureRender.shapeSvg;
            if (figureRender && figureRender.iconSvg) iconSvg = figureRender.iconSvg;
        }

        var node = "";
        node += '<g class="archi-node" id="' + escapeAttr(object.id) + '" data-archi-type="' + escapeAttr(object.type || "") + '">';
        node += shapeSvg;
        if (iconSvg) node += iconSvg;
        var noteImage = getNoteImageSpec(object, opts);
        if (noteImage) {
            var ib = resolveNoteImageBox(b, noteImage.position, noteImage.size);
            var symbolId = ensureImageSymbol(noteImage.href, opts);
            if (symbolId) {
                node += '<use href="#' + symbolId + '" xlink:href="#' + symbolId + '" x="' + ib.x + '" y="' + ib.y + '" width="' + ib.width + '" height="' + ib.height + '"/>';
            } else {
                node += '<image x="' + ib.x + '" y="' + ib.y + '" width="' + ib.width + '" height="' + ib.height + '" href="' + escapeAttr(noteImage.href) + '" preserveAspectRatio="xMidYMid meet"/>';
            }
        }
        if (label) {
            var clipId = "clip-node-label-" + toSafeIdFragment(object.id);
            node += '<defs><clipPath id="' + clipId + '"><rect x="' + b.x + '" y="' + b.y + '" width="' + b.width + '" height="' + b.height + '"/></clipPath></defs>';
            node += renderMultilineText(
                Math.round(labelX),
                labelY,
                lines.join("\n"),
                'fill="' + escapeAttr(textStyle.color) + '" font-family="' + escapeAttr(textStyle.family) + '" font-size="' + textStyle.size + 'px" font-style="' + escapeAttr(textStyle.style) + '" font-weight="' + escapeAttr(textStyle.weight) + '" text-anchor="' + textAnchor + '" clip-path="url(#' + clipId + ')"',
                lineHeight
            );
        }
        node += "</g>\n";
        return node;
    }

    function isRelationshipObject(object) {
        return !!(object && object.source && object.target && !object.bounds);
    }

    function isNestedRelationship(object, boundsById) {
        var sourceBounds = boundsById[object.source.id];
        var targetBounds = boundsById[object.target.id];
        if (!sourceBounds || !targetBounds) return false;

        function contains(a, b) {
            return b.x >= a.x &&
                b.y >= a.y &&
                (b.x + b.width) <= (a.x + a.width) &&
                (b.y + b.height) <= (a.y + a.height);
        }

        return contains(sourceBounds, targetBounds) || contains(targetBounds, sourceBounds);
    }

    function normalizeBendpointRaw(bp) {
        if (!bp) return null;
        var p = pointFromAny(bp);
        if (p && isFinite(p.x) && isFinite(p.y)) {
            return { mode: "absolute", x: p.x, y: p.y };
        }
        if (typeof bp.sourceX === "number" && typeof bp.sourceY === "number") {
            return { mode: "sourceRelative", x: bp.sourceX, y: bp.sourceY };
        }
        if (typeof bp.targetX === "number" && typeof bp.targetY === "number") {
            return { mode: "targetRelative", x: bp.targetX, y: bp.targetY };
        }
        if (typeof bp.getSourceX === "function" && typeof bp.getSourceY === "function") {
            return { mode: "sourceRelative", x: toNumber(bp.getSourceX(), 0), y: toNumber(bp.getSourceY(), 0) };
        }
        if (typeof bp.getTargetX === "function" && typeof bp.getTargetY === "function") {
            return { mode: "targetRelative", x: toNumber(bp.getTargetX(), 0), y: toNumber(bp.getTargetY(), 0) };
        }
        var raw = safeString(bp);
        if (raw) {
            var m = {};
            raw.replace(/(startX|startY|endX|endY)\s*=\s*(-?\d+(?:\.\d+)?)/g, function(_all, key, num) {
                m[key] = Number(num);
                return _all;
            });
            if (isFinite(m.startX) && isFinite(m.startY) && isFinite(m.endX) && isFinite(m.endY)) {
                return {
                    mode: "pairRelative",
                    startX: m.startX,
                    startY: m.startY,
                    endX: m.endX,
                    endY: m.endY
                };
            }
        }
        return null;
    }

    function relationBoundsOf(object) {
        if (!object || !object.bounds) return null;
        var b = object.bounds;
        var x = toNumberLike(b.x, NaN);
        var y = toNumberLike(b.y, NaN);
        var w = toNumberLike(b.width, NaN);
        var h = toNumberLike(b.height, NaN);
        if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return null;
        return { x: x, y: y, width: w, height: h };
    }

    function absolutizeIfRelationLocal(pointValue, relationBounds) {
        if (!pointValue) return null;
        if (!relationBounds) return pointValue;
        // Heuristic: when point coordinates fit inside relationship bounds dimensions,
        // they are often local coordinates in Archi/JArchi APIs.
        if (pointValue.x >= 0 && pointValue.y >= 0 &&
            pointValue.x <= relationBounds.width && pointValue.y <= relationBounds.height) {
            return point(relationBounds.x + pointValue.x, relationBounds.y + pointValue.y);
        }
        return pointValue;
    }

    function toAbsoluteBendpoint(raw, sourceAnchor, targetAnchor, relationBounds, sourceBounds, targetBounds, sourceCenter, targetCenter) {
        if (!raw) return null;
        if (raw.mode === "absolute") return absolutizeIfRelationLocal(point(raw.x, raw.y), relationBounds);
        if (raw.mode === "sourceRelative") return point(sourceAnchor.x + raw.x, sourceAnchor.y + raw.y);
        if (raw.mode === "targetRelative") return point(targetAnchor.x + raw.x, targetAnchor.y + raw.y);
        if (raw.mode === "pairRelative") {
            // jArchi relative bendpoints are primarily expressed from source-center offsets
            // (startX/startY). endX/endY are equivalent offsets from target center.
            var pStart = sourceCenter ? point(sourceCenter.x + raw.startX, sourceCenter.y + raw.startY) :
                (sourceBounds ? point(sourceBounds.x + raw.startX, sourceBounds.y + raw.startY) : null);
            if (pStart) return pStart;
            var pEnd = targetCenter ? point(targetCenter.x + raw.endX, targetCenter.y + raw.endY) :
                (targetBounds ? point(targetBounds.x + raw.endX, targetBounds.y + raw.endY) : null);
            return pEnd;
        }
        return null;
    }

    function getExplicitEndpoint(object, key) {
        var candidate = object[key];
        var p = pointFromAny(candidate);
        if (p && isFinite(p.x) && isFinite(p.y)) return p;
        if (key === "sourcePoint") {
            p = pointFromAny(safeCall(object, "getSourcePoint", null));
            if (p && isFinite(p.x) && isFinite(p.y)) return p;
            var sx = toNumberLike(safeCall(object, "getSourceX", NaN), NaN);
            var sy = toNumberLike(safeCall(object, "getSourceY", NaN), NaN);
            if (isFinite(sx) && isFinite(sy)) return point(sx, sy);
            sx = toNumberLike(object.sourceX, NaN);
            sy = toNumberLike(object.sourceY, NaN);
            if (isFinite(sx) && isFinite(sy)) return point(sx, sy);
        }
        if (key === "targetPoint") {
            p = pointFromAny(safeCall(object, "getTargetPoint", null));
            if (p && isFinite(p.x) && isFinite(p.y)) return p;
            var tx = toNumberLike(safeCall(object, "getTargetX", NaN), NaN);
            var ty = toNumberLike(safeCall(object, "getTargetY", NaN), NaN);
            if (isFinite(tx) && isFinite(ty)) return point(tx, ty);
            tx = toNumberLike(object.targetX, NaN);
            ty = toNumberLike(object.targetY, NaN);
            if (isFinite(tx) && isFinite(ty)) return point(tx, ty);
        }
        return null;
    }

    function resolveRelationshipEndpoints(object, sourceBounds, targetBounds, sourceCenter, targetCenter) {
        var relBounds = relationBoundsOf(object);
        var explicitSource = getExplicitEndpoint(object, "sourcePoint");
        var explicitTarget = getExplicitEndpoint(object, "targetPoint");
        explicitSource = absolutizeIfRelationLocal(explicitSource, relBounds);
        explicitTarget = absolutizeIfRelationLocal(explicitTarget, relBounds);

        var sourceAnchor = explicitSource;
        var targetAnchor = explicitTarget;

        function overlapRange(a1, a2, b1, b2) {
            var lo = Math.max(Math.min(a1, a2), Math.min(b1, b2));
            var hi = Math.min(Math.max(a1, a2), Math.max(b1, b2));
            if (hi < lo) return null;
            return { lo: lo, hi: hi };
        }

        // Prefer orthogonal box-to-box anchors when possible (matches native Archi routing better).
        if (!sourceAnchor && !targetAnchor && sourceBounds && targetBounds) {
            var xOverlap = overlapRange(
                sourceBounds.x, sourceBounds.x + sourceBounds.width,
                targetBounds.x, targetBounds.x + targetBounds.width
            );
            var yOverlap = overlapRange(
                sourceBounds.y, sourceBounds.y + sourceBounds.height,
                targetBounds.y, targetBounds.y + targetBounds.height
            );

            if (xOverlap) {
                var x = (xOverlap.lo + xOverlap.hi) / 2;
                var sCenterY = sourceBounds.y + sourceBounds.height / 2;
                var tCenterY = targetBounds.y + targetBounds.height / 2;
                if (tCenterY < sCenterY) {
                    sourceAnchor = point(x, sourceBounds.y);
                    targetAnchor = point(x, targetBounds.y + targetBounds.height);
                } else {
                    sourceAnchor = point(x, sourceBounds.y + sourceBounds.height);
                    targetAnchor = point(x, targetBounds.y);
                }
            } else if (yOverlap) {
                var y = (yOverlap.lo + yOverlap.hi) / 2;
                var sCenterX = sourceBounds.x + sourceBounds.width / 2;
                var tCenterX = targetBounds.x + targetBounds.width / 2;
                if (tCenterX < sCenterX) {
                    sourceAnchor = point(sourceBounds.x, y);
                    targetAnchor = point(targetBounds.x + targetBounds.width, y);
                } else {
                    sourceAnchor = point(sourceBounds.x + sourceBounds.width, y);
                    targetAnchor = point(targetBounds.x, y);
                }
            }
        }

        if (!sourceAnchor) {
            sourceAnchor = sourceBounds ? anchorOnRectToward(sourceBounds, targetCenter) : sourceCenter;
        }
        if (!targetAnchor) {
            targetAnchor = targetBounds ? anchorOnRectToward(targetBounds, sourceCenter) : targetCenter;
        }

        return { sourceAnchor: sourceAnchor, targetAnchor: targetAnchor };
    }

    function toArrayLike(listLike) {
        if (!listLike) return [];
        if (Array.isArray(listLike)) return listLike;
        var out = [];
        if (typeof listLike.forEach === "function") {
            listLike.forEach(function(item) { out.push(item); });
            return out;
        }
        if (typeof listLike.size === "function" && typeof listLike.get === "function") {
            for (var i = 0; i < listLike.size(); i++) out.push(listLike.get(i));
            return out;
        }
        if (typeof listLike.length === "number") {
            for (var j = 0; j < listLike.length; j++) out.push(listLike[j]);
            return out;
        }
        return out;
    }

    function dedupeAdjacentPoints(points) {
        if (!points || points.length < 2) return points || [];
        var out = [points[0]];
        for (var i = 1; i < points.length; i++) {
            var a = out[out.length - 1];
            var b = points[i];
            if (Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001) continue;
            out.push(b);
        }
        return out;
    }

    function orthogonalAnchorFromExternal(rect, externalPoint) {
        if (!rect || !externalPoint) return null;
        var left = rect.x;
        var right = rect.x + rect.width;
        var top = rect.y;
        var bottom = rect.y + rect.height;

        if (externalPoint.x <= left && externalPoint.y >= top && externalPoint.y <= bottom) {
            return point(left, externalPoint.y);
        }
        if (externalPoint.x >= right && externalPoint.y >= top && externalPoint.y <= bottom) {
            return point(right, externalPoint.y);
        }
        if (externalPoint.y <= top && externalPoint.x >= left && externalPoint.x <= right) {
            return point(externalPoint.x, top);
        }
        if (externalPoint.y >= bottom && externalPoint.x >= left && externalPoint.x <= right) {
            return point(externalPoint.x, bottom);
        }
        return anchorOnRectToward(rect, externalPoint);
    }

    function getRelationshipPoints(object, sourceAnchor, targetAnchor, sourceBounds, targetBounds, sourceCenter, targetCenter) {
        var relBounds = relationBoundsOf(object);
        var corePoints = [];

        var candidates = null;
        if (object.bendpoints) {
            candidates = object.bendpoints;
        } else if (object.relativeBendpoints) {
            candidates = object.relativeBendpoints;
        } else {
            var byGetter = safeCall(object, "getBendpoints", null);
            if (byGetter) candidates = byGetter;
            if (!candidates) {
                var byGetterRel = safeCall(object, "getRelativeBendpoints", null);
                if (byGetterRel) candidates = byGetterRel;
            }
        }

        if (candidates) {
            toArrayLike(candidates).forEach(function(point) {
                var raw = normalizeBendpointRaw(point);
                var p = toAbsoluteBendpoint(raw, sourceAnchor, targetAnchor, relBounds, sourceBounds, targetBounds, sourceCenter, targetCenter);
                if (p && isFinite(p.x) && isFinite(p.y)) {
                    corePoints.push(p);
                }
            });
        }

        var start = sourceAnchor;
        var end = targetAnchor;

        if (corePoints.length) {
            start = sourceBounds ? orthogonalAnchorFromExternal(sourceBounds, corePoints[0]) : corePoints[0];
            var lastCore = corePoints[corePoints.length - 1];
            if (targetBounds) {
                end = orthogonalAnchorFromExternal(targetBounds, lastCore);
            } else {
                end = targetAnchor;
            }
        } else {
            var routerRaw = safeString(object.routerType != null ? object.routerType : safeCall(object, "getRouterType", "")).toLowerCase();
            if (routerRaw.indexOf("orth") >= 0) {
                var dx = Math.abs(targetAnchor.x - sourceAnchor.x);
                var dy = Math.abs(targetAnchor.y - sourceAnchor.y);
                if (dx >= dy) {
                    corePoints.push(point(targetAnchor.x, sourceAnchor.y));
                } else {
                    corePoints.push(point(sourceAnchor.x, targetAnchor.y));
                }
            }
        }

        var points = [start];
        corePoints.forEach(function(p) { points.push(p); });
        points.push(end);
        return dedupeAdjacentPoints(points);
    }

    function buildPolylineD(points) {
        if (!points.length) return "";
        var d = "M" + points[0].x + " " + points[0].y;
        for (var i = 1; i < points.length; i++) {
            d += " L" + points[i].x + " " + points[i].y;
        }
        return d;
    }

    function getLabelPoint(points) {
        if (points.length < 2) return points[0];
        var midSegment = Math.floor((points.length - 1) / 2);
        var a = points[midSegment];
        var b = points[midSegment + 1];
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        };
    }

    function getPolylineLength(points) {
        var total = 0;
        for (var i = 1; i < points.length; i++) {
            var dx = points[i].x - points[i - 1].x;
            var dy = points[i].y - points[i - 1].y;
            total += Math.sqrt(dx * dx + dy * dy);
        }
        return total;
    }

    function pointAtRatio(points, ratio) {
        if (!points.length) return point(0, 0);
        if (points.length === 1) return points[0];

        var total = getPolylineLength(points);
        if (total <= 0) return points[0];
        var targetDistance = total * ratio;
        var walked = 0;

        for (var i = 1; i < points.length; i++) {
            var a = points[i - 1];
            var b = points[i];
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var seg = Math.sqrt(dx * dx + dy * dy);
            if (walked + seg >= targetDistance && seg > 0) {
                var t = (targetDistance - walked) / seg;
                return point(a.x + dx * t, a.y + dy * t);
            }
            walked += seg;
        }
        return points[points.length - 1];
    }

    function resolveRelationshipLabelPosition(object, preferenceSummary) {
        var raw = "";
        if (object.textPosition != null) raw = String(object.textPosition).toLowerCase();
        else if (object.labelPosition != null) raw = String(object.labelPosition).toLowerCase();
        else if (object.prop && object.prop("textPosition") != null) raw = String(object.prop("textPosition")).toLowerCase();
        else if (preferenceSummary && preferenceSummary.textPosition != null) raw = String(preferenceSummary.textPosition).toLowerCase();
        else if (preferenceSummary && preferenceSummary.labelPosition != null) raw = String(preferenceSummary.labelPosition).toLowerCase();

        var n = toNumberLike(raw, NaN);
        if (isFinite(n)) {
            if (n === 0) return "source";
            if (n === 2) return "target";
            return "middle";
        }
        if (raw.indexOf("source") >= 0) return "source";
        if (raw.indexOf("target") >= 0) return "target";
        return "middle";
    }

    function getRelationshipLabelPoint(object, points, preferenceSummary) {
        var pos = resolveRelationshipLabelPosition(object, preferenceSummary);
        if (pos === "source") return pointAtRatio(points, 0.2);
        if (pos === "target") return pointAtRatio(points, 0.8);
        return getLabelPoint(points);
    }

    function getRelationshipStyleByType(typeRaw, explicitDash) {
        if (typeof globalThis !== "undefined" && globalThis.archiRelationshipLibrary && typeof globalThis.archiRelationshipLibrary.getStyleByType === "function") {
            return globalThis.archiRelationshipLibrary.getStyleByType(typeRaw, explicitDash);
        }
        return {
            dash: explicitDash || "",
            startDeco: null,
            endDeco: "filledTriangle"
        };
    }

    function renderRelationshipDecorations(points, stroke, lineWidth, styleSpec) {
        if (typeof globalThis !== "undefined" && globalThis.archiRelationshipLibrary && typeof globalThis.archiRelationshipLibrary.renderDecorations === "function") {
            return globalThis.archiRelationshipLibrary.renderDecorations(points, stroke, lineWidth, styleSpec);
        }
        return "";
    }

    function renderRelationship(object, centerById, boundsById, opts, preferenceSummary) {
        var source = object.source;
        var target = object.target;
        if (!source || !target) return "";
        if (isNestedRelationship(object, boundsById)) return "";

        var sourceCenter = centerById[source.id];
        var targetCenter = centerById[target.id];
        if (!sourceCenter || !targetCenter) return "";
        var sourceBounds = boundsById[source.id];
        var targetBounds = boundsById[target.id];
        var endpoints = resolveRelationshipEndpoints(object, sourceBounds, targetBounds, sourceCenter, targetCenter);
        var points = getRelationshipPoints(object, endpoints.sourceAnchor, endpoints.targetAnchor, sourceBounds, targetBounds, sourceCenter, targetCenter);
        var d = buildPolylineD(points);
        if (!d) return "";

        var stroke = safeColor(object.lineColor, "#666");
        var textStyle = getTextStyleForObject(object, opts, { color: "#444", size: Math.max(10, opts.fontSize - 1) });
        var lineWidth = parseLineWidth(object.lineWidth, 1.2);
        var dashArrayValue = parseLineStyleDashArray(object.lineStyle);
        var relStyle = getRelationshipStyleByType(object.type, dashArrayValue);
        var dashArray = relStyle.dash ? (' stroke-dasharray="' + relStyle.dash + '"') : "";
        var lineOpacity = parseOpacityField(object.outlineOpacity != null ? object.outlineOpacity : object.opacity);

        var out = "";
        out += '<g class="archi-relationship" id="' + escapeAttr(object.id) + '" data-archi-type="' + escapeAttr(object.type || "") + '">';
        out += '<path d="' + d + '" stroke="' + escapeAttr(stroke) + '" stroke-width="' + lineWidth + '"' +
            (lineOpacity !== null ? (' opacity="' + lineOpacity + '"') : "") +
            dashArray + '/>';
        out += renderRelationshipDecorations(points, stroke, lineWidth, relStyle);

        var relLabel = resolveLabel(object);
        if (relLabel) {
            var labelPoint = getRelationshipLabelPoint(object, points, preferenceSummary);
            out += renderMultilineText(
                Math.round(labelPoint.x + 4),
                Math.round(labelPoint.y - 4),
                relLabel,
                'fill="' + escapeAttr(textStyle.color) + '" font-family="' + escapeAttr(textStyle.family) + '" font-size="' + textStyle.size + 'px" font-style="' + escapeAttr(textStyle.style) + '" font-weight="' + escapeAttr(textStyle.weight) + '"',
                Math.max(11, Math.floor(textStyle.size * 1.2))
            );
        }
        out += "</g>\n";
        return out;
    }

    function renderDefs(opts) {
        var extra = (opts && opts._imageDefs && opts._imageDefs.length) ? opts._imageDefs.join("") : "";
        return "<defs>" + extra + "</defs>\n";
    }

    function exportViewToSemanticSvg(view, options) {
        if (!view) {
            throw new Error("exportViewToSemanticSvg(view, options): 'view' is required.");
        }

        var opts = withDefaults(options);
        var preferenceSummary = readPreferenceSummary(opts);
        var elements = [];
        var allObjects = [];
        collectViewObjectsRecursively(view, 0, 0, elements, allObjects);

        var canvas = computeCanvas(elements, opts.margin);
        var centerById = buildElementCenterMap(elements);
        var boundsById = buildElementBoundsMap(elements);

        var elementsLayer = "";
        elements.forEach(function(entry) {
            elementsLayer += renderNode(entry, opts, preferenceSummary);
        });

        var relationshipsLayer = "";
        allObjects.forEach(function(object) {
            if (isRelationshipObject(object)) {
                relationshipsLayer += renderRelationship(object, centerById, boundsById, opts, preferenceSummary);
            }
        });

        var svg = "";
        svg += '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
        svg += ' viewBox="' + canvas.x + " " + canvas.y + " " + canvas.width + " " + canvas.height + '"';
        svg += ' role="img" aria-label="' + escapeAttr(view.name || "Archi View") + '">\n';
        svg += renderDefs(opts);
        svg += renderSemanticStyles(opts) + "\n";
        svg += '<rect x="' + canvas.x + '" y="' + canvas.y + '" width="' + canvas.width + '" height="' + canvas.height + '" fill="' + escapeAttr(opts.backgroundColor) + '"/>\n';
        svg += '<g id="layer-elements">\n';
        svg += elementsLayer;
        svg += "</g>\n";

        svg += '<g id="layer-relationships">\n';
        svg += relationshipsLayer;
        svg += "</g>\n";
        svg += "</svg>\n";
        return svg;
    }

    function exportViewToSemanticSvgFile(view, filePath, options) {
        if (!filePath) {
            throw new Error("exportViewToSemanticSvgFile(view, filePath, options): 'filePath' is required.");
        }
        var opts = withDefaults(options);
        opts._exportFilePath = filePath;
        var svg = exportViewToSemanticSvg(view, opts);
        $.fs.writeFile(filePath, svg, "UTF8");
        return svg;
    }

    var api = {
        exportViewToSemanticSvg: exportViewToSemanticSvg,
        exportViewToSemanticSvgFile: exportViewToSemanticSvgFile
    };

    if (typeof globalThis !== "undefined") {
        globalThis.viewToSvgSemantic = api;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})();
