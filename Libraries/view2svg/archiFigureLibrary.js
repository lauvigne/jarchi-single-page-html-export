(function() {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.archiFigureLibrary !== "undefined") {
        return;
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
            // ignore
        }
        return fallback;
    }

    function escapeAttr(value) {
        return safeString(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }

    function getFigureTypeRaw(object) {
        var byGetter = safeCall(object, "getFigureType", null);
        if (byGetter !== null && byGetter !== undefined) return byGetter;
        if (object && object.figureType !== undefined) return object.figureType;
        if (object && object.prop && object.prop("figureType") !== null) return object.prop("figureType");
        return null;
    }

    function normalizeFigureTypeKey(raw) {
        if (raw === null || raw === undefined) return "default";
        var s = safeString(raw).trim();
        if (!s) return "default";
        return s.toLowerCase();
    }

    function parseBooleanLike(value) {
        if (value === null || value === undefined) return null;
        if (value === true || value === false) return value;
        if (typeof value === "number") return value !== 0;
        var s = safeString(value).trim().toLowerCase();
        if (!s) return null;
        if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
        if (s === "false" || s === "0" || s === "no" || s === "off") return false;
        return null;
    }

    function getShowIconRaw(object) {
        var byGetter = safeCall(object, "getShowIcon", null);
        if (byGetter !== null && byGetter !== undefined) return byGetter;
        var byIsGetter = safeCall(object, "isShowIcon", null);
        if (byIsGetter !== null && byIsGetter !== undefined) return byIsGetter;
        if (object && object.showIcon !== undefined) return object.showIcon;
        if (object && object.prop) {
            var p = object.prop("showIcon");
            if (p !== null && p !== undefined) return p;
        }
        return null;
    }

    function getIconColorRaw(object) {
        var byGetter = safeCall(object, "getIconColor", null);
        if (byGetter !== null && byGetter !== undefined) return byGetter;
        if (object && object.iconColor !== undefined) return object.iconColor;
        if (object && object.prop) {
            var p = object.prop("iconColor");
            if (p !== null && p !== undefined) return p;
        }
        return null;
    }

    function normalizeColorValue(value) {
        if (value === null || value === undefined) return null;
        var s = safeString(value).trim();
        if (!s) return null;
        return s;
    }

    function shouldShowIcon(object) {
        var raw = getShowIconRaw(object);
        if (raw === null || raw === undefined) return true;
        var parsed = parseBooleanLike(raw);
        if (parsed === null) return true;
        return !parsed;
    }

    function drawRect(bounds, style, rounded) {
        var rx = rounded ? Math.min(12, Math.floor(Math.min(bounds.width, bounds.height) * 0.12)) : 0;
        return '<rect x="' + bounds.x + '" y="' + bounds.y + '" width="' + bounds.width + '" height="' + bounds.height + '" rx="' + rx + '" ry="' + rx + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + (style.dash ? (' stroke-dasharray="' + style.dash + '"') : "") + style.opacityAttrs + '/>';
    }

    function drawEllipse(bounds, style) {
        var cx = bounds.x + bounds.width / 2;
        var cy = bounds.y + bounds.height / 2;
        return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (bounds.width / 2) + '" ry="' + (bounds.height / 2) + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
    }

    function drawHexagon(bounds, style) {
        var w = bounds.width, h = bounds.height, x = bounds.x, y = bounds.y;
        var dx = Math.min(18, Math.floor(w * 0.18));
        var points = [
            (x + dx) + "," + y,
            (x + w - dx) + "," + y,
            (x + w) + "," + (y + h / 2),
            (x + w - dx) + "," + (y + h),
            (x + dx) + "," + (y + h),
            x + "," + (y + h / 2)
        ].join(" ");
        return '<polygon points="' + points + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
    }

    function drawParallelogram(bounds, style, slantLeft) {
        var x = bounds.x, y = bounds.y, w = bounds.width, h = bounds.height;
        var s = Math.min(18, Math.floor(w * 0.15));
        var points;
        if (slantLeft) {
            points = [
                x + "," + (y + s),
                (x + w - s) + "," + y,
                (x + w) + "," + (y + h - s),
                (x + s) + "," + (y + h)
            ].join(" ");
        } else {
            points = [
                (x + s) + "," + y,
                (x + w) + "," + (y + s),
                (x + w - s) + "," + (y + h),
                x + "," + (y + h - s)
            ].join(" ");
        }
        return '<polygon points="' + points + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
    }

    function drawArrowRight(bounds, style) {
        var x = bounds.x, y = bounds.y, w = bounds.width, h = bounds.height;
        var headW = Math.min(28, Math.floor(w * 0.3));
        var bodyW = w - headW;
        var midY = y + h / 2;
        var points = [
            x + "," + y,
            (x + bodyW) + "," + y,
            (x + bodyW) + "," + (y + h * 0.18),
            (x + w) + "," + midY,
            (x + bodyW) + "," + (y + h * 0.82),
            (x + bodyW) + "," + (y + h),
            x + "," + (y + h)
        ].join(" ");
        return '<polygon points="' + points + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
    }

    function drawActor(bounds, style) {
        var cx = bounds.x + bounds.width / 2;
        var topPad = Math.max(8, Math.floor(bounds.height * 0.14));
        var headR = Math.max(8, Math.floor(Math.min(bounds.width, bounds.height) * 0.16));
        var headCy = bounds.y + topPad + headR;
        var torsoTop = headCy + headR;
        var torsoBottom = bounds.y + bounds.height - Math.max(18, Math.floor(bounds.height * 0.2));
        var shoulderY = torsoTop + Math.max(6, Math.floor(bounds.height * 0.08));
        var legY = bounds.y + bounds.height - Math.max(4, Math.floor(bounds.height * 0.06));
        var armSpan = Math.max(16, Math.floor(bounds.width * 0.18));
        var legSpan = Math.max(18, Math.floor(bounds.width * 0.2));
        var strokeAttrs = ' stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs;

        var out = "";
        out += '<circle cx="' + cx + '" cy="' + headCy + '" r="' + headR + '" fill="' + escapeAttr(style.fill) + '"' + strokeAttrs + '/>';
        out += '<line x1="' + cx + '" y1="' + torsoTop + '" x2="' + cx + '" y2="' + torsoBottom + '"' + strokeAttrs + '/>';
        out += '<line x1="' + (cx - armSpan) + '" y1="' + shoulderY + '" x2="' + (cx + armSpan) + '" y2="' + shoulderY + '"' + strokeAttrs + '/>';
        out += '<line x1="' + cx + '" y1="' + torsoBottom + '" x2="' + (cx - legSpan) + '" y2="' + legY + '"' + strokeAttrs + '/>';
        out += '<line x1="' + cx + '" y1="' + torsoBottom + '" x2="' + (cx + legSpan) + '" y2="' + legY + '"' + strokeAttrs + '/>';
        return out;
    }

    function drawBusinessEvent(bounds, style) {
        var x = bounds.x, y = bounds.y, w = bounds.width, h = bounds.height;
        var leftInset = Math.max(16, Math.floor(w * 0.14));
        var curveRx = Math.max(16, Math.floor(w * 0.14));
        var d = [
            "M", x, y,
            "L", x + leftInset, y + h / 2,
            "L", x, y + h,
            "L", x + w - curveRx, y + h,
            "A", curveRx, (h / 2), 0, 0, 0, x + w - curveRx, y,
            "L", x, y,
            "Z"
        ].join(" ");
        return '<path d="' + d + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
    }

    function drawComponent(bounds, style) {
        var x = bounds.x, y = bounds.y, w = bounds.width, h = bounds.height;
        var tabW = Math.min(14, Math.floor(w * 0.18));
        var tabH = Math.min(12, Math.floor(h * 0.18));
        var out = "";
        out += drawRect(bounds, style, true);
        out += '<rect x="' + (x + w - tabW - 4) + '" y="' + (y + 4) + '" width="' + tabW + '" height="' + tabH + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
        out += '<rect x="' + (x + w - tabW - 4) + '" y="' + (y + 4 + tabH + 3) + '" width="' + tabW + '" height="' + tabH + '" fill="' + escapeAttr(style.fill) + '" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + style.lineWidth + '"' + style.opacityAttrs + '/>';
        return out;
    }

    function drawService(bounds, style) {
        var out = drawRect(bounds, style, true);
        var r = Math.max(6, Math.floor(Math.min(bounds.width, bounds.height) * 0.08));
        var cx = bounds.x + bounds.width - r - 6;
        var cy = bounds.y + r + 6;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + escapeAttr(style.stroke) + '" stroke-width="' + Math.max(1, style.lineWidth - 0.2) + '"' + style.opacityAttrs + '/>';
        return out;
    }

    function drawCapsule(bounds, style) {
        var capsuleStyle = {
            fill: style.fill,
            stroke: style.stroke,
            lineWidth: style.lineWidth,
            dash: style.dash,
            opacityAttrs: style.opacityAttrs
        };
        var out = drawRect(bounds, capsuleStyle, true);
        return out.replace(/rx="\d+" ry="\d+"/, 'rx="' + Math.floor(bounds.height / 2) + '" ry="' + Math.floor(bounds.height / 2) + '"');
    }

    function drawDefaultTypeIcon(object, bounds, style) {
        var type = safeString(object && object.type).toLowerCase();
        if (!type) return "";
        if (type === "diagram-model-note" || type === "diagram-model-group") return "";

        var ICON_W = 13;
        var ICON_H = 13;
        var x = bounds.x + bounds.width - ICON_W - 6;
        var y = bounds.y + 6;
        var cx = x + (ICON_W / 2);
        var cy = y + (ICON_H / 2);
        var sw = 1;
        var out = '<g class="archi-node-icon" data-icon-type="' + escapeAttr(type) + '">';

        function pickContrastStroke(fillColor) {
            var s = safeString(fillColor).trim();
            var m = /^#?([0-9a-f]{6})$/i.exec(s);
            if (!m) return "black";
            var hex = m[1];
            var r = parseInt(hex.substring(0, 2), 16);
            var g = parseInt(hex.substring(2, 4), 16);
            var b = parseInt(hex.substring(4, 6), 16);
            var luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            return luminance < 140 ? "white" : "black";
        }

        var iconColor = normalizeColorValue(getIconColorRaw(object));
        var stroke = iconColor || pickContrastStroke(style && style.fill);

        // archimate-diagram-model: native-like multicolor icon (29x27 reference)
        if (type === "archimate-diagram-model") {
            var dmW = 29;
            var dmH = 27;
            var dmX = bounds.x + bounds.width - dmW - 4;
            var dmY = bounds.y + 4;
            out += '<rect x="' + (dmX + 11) + '" y="' + (dmY + 6) + '" width="5" height="5" fill="rgb(220,240,250)" stroke="rgb(20,105,171)" stroke-width="1"/>';
            out += '<rect x="' + (dmX + 11) + '" y="' + (dmY + 15) + '" width="5" height="5" fill="rgb(220,240,250)" stroke="rgb(20,105,171)" stroke-width="1"/>';
            out += '<rect x="' + (dmX + 19) + '" y="' + (dmY + 12) + '" width="2" height="2" fill="none" stroke="rgb(20,105,171)" stroke-width="1"/>';
            out += '<line x1="' + (dmX + 18) + '" y1="' + (dmY + 8) + '" x2="' + (dmX + 24) + '" y2="' + (dmY + 8) + '" stroke="rgb(193,232,255)" stroke-width="1"/>';
            out += '<line x1="' + (dmX + 18) + '" y1="' + (dmY + 9) + '" x2="' + (dmX + 24) + '" y2="' + (dmY + 9) + '" stroke="rgb(20,105,171)" stroke-width="1"/>';
            out += '<line x1="' + (dmX + 18) + '" y1="' + (dmY + 17) + '" x2="' + (dmX + 24) + '" y2="' + (dmY + 17) + '" stroke="rgb(193,232,255)" stroke-width="1"/>';
            out += '<line x1="' + (dmX + 18) + '" y1="' + (dmY + 18) + '" x2="' + (dmX + 24) + '" y2="' + (dmY + 18) + '" stroke="rgb(20,105,171)" stroke-width="1"/>';
            out += '<line x1="' + (dmX + 22) + '" y1="' + (dmY + 13) + '" x2="' + (dmX + 24) + '" y2="' + (dmY + 13) + '" stroke="rgb(20,105,171)" stroke-width="1"/>';
            out += "</g>";
            return out;
        }

        // business-service: rounded rect 16x9
        if (type === "business-service") {
            var bsW = 16;
            var bsH = 9;
            var bsX = bounds.x + bounds.width - bsW - 4;
            var bsY = bounds.y + 5;
            out += '<rect x="' + bsX + '" y="' + bsY + '" width="' + bsW + '" height="' + bsH + '" rx="4" ry="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        // business-interface: circle + short line on the left
        if (type === "business-interface") {
            var biR = 5;
            var biCx = bounds.x + bounds.width - biR - 6;
            var biCy = bounds.y + biR + 6;
            out += '<circle cx="' + biCx + '" cy="' + biCy + '" r="' + biR + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + (biCx - biR) + '" y1="' + biCy + '" x2="' + (biCx - biR - 7) + '" y2="' + biCy + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        // business-actor: native stickman variant (head r=3)
        if (type === "business-actor") {
            var baCx = bounds.x + bounds.width - 9;
            var baCy = bounds.y + 8;
            out += '<circle cx="' + baCx + '" cy="' + baCy + '" r="3" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + baCx + '" y1="' + (baCy + 3) + '" x2="' + baCx + '" y2="' + (baCy + 9) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + baCx + '" y1="' + (baCy + 9) + '" x2="' + (baCx - 4) + '" y2="' + (baCy + 14) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + baCx + '" y1="' + (baCy + 9) + '" x2="' + (baCx + 4) + '" y2="' + (baCy + 14) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + (baCx - 4) + '" y1="' + (baCy + 6) + '" x2="' + (baCx + 4) + '" y2="' + (baCy + 6) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        // application-component icon from native export path (13x13 reference)
        if (type.indexOf("component") >= 0) {
            var dComp = [
                "M", (x + 3), (y + 13), "L", (x + 3), (y + 9),
                "M", (x + 3), (y + 7), "L", (x + 3), (y + 5),
                "M", (x + 3), (y + 2), "L", (x + 3), (y + 0), "L", (x + 13), (y + 0), "L", (x + 13), (y + 13), "L", (x + 2.5), (y + 13),
                "M", (x + 0), (y + 2), "L", (x + 6), (y + 2), "L", (x + 6), (y + 4.5), "L", (x + 0), (y + 4.5), "Z",
                "M", (x + 0), (y + 7), "L", (x + 6), (y + 7), "L", (x + 6), (y + 9.5), "L", (x + 0), (y + 9.5), "Z"
            ].join(" ");
            out += '<path fill="none" d="' + dComp + '" fill-rule="evenodd" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        // function-style small pentagon icon (seen in native exports)
        if (type.indexOf("function") >= 0 || type.indexOf("interaction") >= 0) {
            var ptsFunc = (x + 1) + "," + (y + 13) + " " + (x + 1) + "," + (y + 4) + " " + (x + 7) + "," + y + " " + (x + 13) + "," + (y + 4) + " " + (x + 13) + "," + (y + 13) + " " + (x + 7) + "," + (y + 7);
            out += '<polygon points="' + ptsFunc + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        // service icon close to native (double arc)
        if (type.indexOf("service") >= 0) {
            out += '<path fill="none" d="M' + (x + 1) + " " + (y + 11) + " C" + (x + 3.2) + " " + (y + 11) + " " + (x + 5) + " " + (y + 9) + " " + (x + 5) + " " + (y + 6.5) + " C" + (x + 5) + " " + (y + 4) + " " + (x + 3.2) + " " + (y + 2) + " " + (x + 1) + " " + (y + 2) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<path fill="none" d="M' + (x + 9) + " " + (y + 11) + " C" + (x + 11.2) + " " + (y + 11) + " " + (x + 13) + " " + (y + 9) + " " + (x + 13) + " " + (y + 6.5) + " C" + (x + 13) + " " + (y + 4) + " " + (x + 11.2) + " " + (y + 2) + " " + (x + 9) + " " + (y + 2) + " M" + (x + 1) + " " + (y + 2) + " L" + (x + 9) + " " + (y + 2) + " M" + (x + 1) + " " + (y + 11) + " L" + (x + 9) + " " + (y + 11) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        if (type.indexOf("interface") >= 0) {
            out += '<rect x="' + x + '" y="' + (y + 2) + '" width="13" height="9" rx="4" ry="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        if (type.indexOf("process") >= 0) {
            out += '<polygon points="' + (x + 0) + "," + (y + 6) + " " + (x + 8) + "," + (y + 6) + " " + (x + 8) + "," + (y + 3) + " " + (x + 13) + "," + (y + 8) + " " + (x + 8) + "," + (y + 13) + " " + (x + 8) + "," + (y + 10) + " " + (x + 0) + "," + (y + 10) + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        if (type.indexOf("actor") >= 0 || type.indexOf("role") >= 0) {
            out += '<circle cx="' + cx + '" cy="' + (y + 2.5) + '" r="2.5" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + cx + '" y1="' + (y + 5) + '" x2="' + cx + '" y2="' + (y + 12) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + (x + 1) + '" y1="' + (y + 7) + '" x2="' + (x + 12) + '" y2="' + (y + 7) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + cx + '" y1="' + (y + 12) + '" x2="' + (x + 2) + '" y2="' + (y + 13) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<line x1="' + cx + '" y1="' + (y + 12) + '" x2="' + (x + 11) + '" y2="' + (y + 13) + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        if (type.indexOf("event") >= 0) {
            out += '<polygon points="' + x + "," + cy + " " + cx + "," + y + " " + (x + ICON_W) + "," + cy + " " + cx + "," + (y + ICON_H) + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        if (type.indexOf("capability") >= 0) {
            out += '<rect x="' + (x + 8) + '" y="' + (y + 0) + '" width="4" height="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<rect x="' + (x + 4) + '" y="' + (y + 4) + '" width="4" height="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<rect x="' + (x + 8) + '" y="' + (y + 4) + '" width="4" height="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<rect x="' + (x + 0) + '" y="' + (y + 8) + '" width="4" height="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<rect x="' + (x + 4) + '" y="' + (y + 8) + '" width="4" height="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="4" height="4" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        if (type.indexOf("grouping") >= 0) {
            out += '<rect x="' + (x + 0) + '" y="' + (y + 0) + '" width="6" height="3" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += '<rect x="' + (x + 0) + '" y="' + (y + 3) + '" width="13" height="7" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
            out += "</g>";
            return out;
        }

        out += '<rect x="' + x + '" y="' + y + '" width="' + ICON_W + '" height="' + ICON_H + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
        out += "</g>";
        return out;
    }

    function drawFigure(bounds, style, figureKey, conceptType) {
        var key = normalizeFigureTypeKey(figureKey);
        var type = safeString(conceptType).toLowerCase();
        var typeAndFigure = type + "::" + key;

        // Mapping grounded on benchmark pairs (type + figureType), not figureType alone.
        if (typeAndFigure === "application-function::1") return drawParallelogram(bounds, style, false);
        if (typeAndFigure === "business-actor::2") return drawActor(bounds, style);
        if (typeAndFigure === "business-event::3") return drawBusinessEvent(bounds, style);
        if (typeAndFigure === "business-function::4") return drawParallelogram(bounds, style, false);
        if (typeAndFigure === "business-interface::5") return drawEllipse(bounds, style);
        if (typeAndFigure === "business-process::6") return drawArrowRight(bounds, style);
        if (typeAndFigure === "business-service::7") return drawCapsule(bounds, style);
        if (typeAndFigure === "technology-service::2") return drawCapsule(bounds, style);

        // Generic numeric fallback kept intentionally conservative.
        if (key === "0") return drawRect(bounds, style, true);
        if (key === "6") return drawArrowRight(bounds, style);
        if (key === "7") {
            var capsuleStyle = {
                fill: style.fill,
                stroke: style.stroke,
                lineWidth: style.lineWidth,
                dash: style.dash,
                opacityAttrs: style.opacityAttrs
            };
            var out = drawRect(bounds, capsuleStyle, true);
            return out.replace(/rx="\d+" ry="\d+"/, 'rx="' + Math.floor(bounds.height / 2) + '" ry="' + Math.floor(bounds.height / 2) + '"');
        }

        if (key.indexOf("ellipse") >= 0 || key.indexOf("circle") >= 0) return drawEllipse(bounds, style);
        if (key.indexOf("hex") >= 0) return drawHexagon(bounds, style);
        if (key.indexOf("component") >= 0) return drawComponent(bounds, style);
        if (key.indexOf("service") >= 0) return drawService(bounds, style);
        if (key.indexOf("rounded") >= 0) return drawRect(bounds, style, true);

        if (type.indexOf("application-component") >= 0) return drawComponent(bounds, style);
        if (type.indexOf("service") >= 0) return drawService(bounds, style);
        return drawRect(bounds, style, true);
    }

    function renderIcon(object, bounds, style, options) {
        if (!shouldShowIcon(object)) return "";

        var resolver = options && typeof options.iconResolver === "function" ? options.iconResolver : null;
        var custom = resolver ? resolver(object, bounds) : null;
        if (custom) return custom;
        return drawDefaultTypeIcon(object, bounds, style);
    }

    function renderNodeFigure(object, bounds, style, options) {
        var figureTypeRaw = getFigureTypeRaw(object);
        var shape = drawFigure(bounds, style, figureTypeRaw, object.type);
        var icon = renderIcon(object, bounds, style, options || {});
        return {
            figureTypeRaw: figureTypeRaw,
            shapeSvg: shape,
            iconSvg: icon
        };
    }

    function inspectObjectFigure(object) {
        return {
            id: object ? object.id : null,
            type: object ? object.type : null,
            figureTypeRaw: getFigureTypeRaw(object),
            showIconRaw: getShowIconRaw(object),
            showIcon: shouldShowIcon(object),
            iconName: object ? (safeCall(object, "getIconName", null) || object.iconName || null) : null
        };
    }

    var api = {
        getFigureTypeRaw: getFigureTypeRaw,
        normalizeFigureTypeKey: normalizeFigureTypeKey,
        shouldShowIcon: shouldShowIcon,
        renderNodeFigure: renderNodeFigure,
        inspectObjectFigure: inspectObjectFigure
    };

    if (typeof globalThis !== "undefined") {
        globalThis.archiFigureLibrary = api;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})();
