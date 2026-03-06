(function() {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.archiRelationshipLibrary !== "undefined") {
        return;
    }

    function safeString(value) {
        if (value === null || value === undefined) return "";
        return String(value);
    }

    function escapeAttr(value) {
        return safeString(value)
            .replaceAll("&", "&amp;")
            .replaceAll("\"", "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    function normalizeVec(dx, dy) {
        var len = Math.sqrt(dx * dx + dy * dy);
        if (!isFinite(len) || len <= 0) return { x: 1, y: 0 };
        return { x: dx / len, y: dy / len };
    }

    function getLastSegment(points) {
        if (!points || points.length < 2) return null;
        for (var i = points.length - 1; i > 0; i--) {
            var a = points[i - 1];
            var b = points[i];
            if (a.x !== b.x || a.y !== b.y) return { from: a, to: b };
        }
        return null;
    }

    function getFirstSegment(points) {
        if (!points || points.length < 2) return null;
        for (var i = 1; i < points.length; i++) {
            var a = points[i - 1];
            var b = points[i];
            if (a.x !== b.x || a.y !== b.y) return { from: a, to: b };
        }
        return null;
    }

    function drawTriangleDecoration(tip, ux, uy, stroke, lineWidth, openShape) {
        var size = Math.max(7, lineWidth * 6);
        var nx = -uy;
        var ny = ux;
        var baseX = tip.x - ux * size;
        var baseY = tip.y - uy * size;
        var p2 = { x: baseX + nx * size * 0.55, y: baseY + ny * size * 0.55 };
        var p3 = { x: baseX - nx * size * 0.55, y: baseY - ny * size * 0.55 };
        if (openShape) {
            return '<path d="M' + p2.x + " " + p2.y + " L" + tip.x + " " + tip.y + " L" + p3.x + " " + p3.y + '" fill="none" stroke="' + escapeAttr(stroke) + '" stroke-width="' + lineWidth + '"/>';
        }
        return '<polygon points="' + tip.x + "," + tip.y + " " + p2.x + "," + p2.y + " " + p3.x + "," + p3.y + '" fill="' + escapeAttr(stroke) + '" stroke="' + escapeAttr(stroke) + '" stroke-width="' + lineWidth + '"/>';
    }

    function drawDiamondDecoration(tip, ux, uy, stroke, lineWidth, filled) {
        var size = Math.max(7, lineWidth * 6);
        var nx = -uy;
        var ny = ux;
        var back = { x: tip.x - ux * size, y: tip.y - uy * size };
        var tail = { x: tip.x - ux * size * 2, y: tip.y - uy * size * 2 };
        var left = { x: back.x + nx * size * 0.55, y: back.y + ny * size * 0.55 };
        var right = { x: back.x - nx * size * 0.55, y: back.y - ny * size * 0.55 };
        return '<polygon points="' + tip.x + "," + tip.y + " " + left.x + "," + left.y + " " + tail.x + "," + tail.y + " " + right.x + "," + right.y + '" fill="' + (filled ? escapeAttr(stroke) : "white") + '" stroke="' + escapeAttr(stroke) + '" stroke-width="' + lineWidth + '"/>';
    }

    function getStyleByType(typeRaw, explicitDash) {
        var type = safeString(typeRaw).toLowerCase();
        var style = {
            dash: explicitDash || "",
            startDeco: null,
            endDeco: "filledTriangle"
        };

        if (type.indexOf("association") >= 0) style.endDeco = null;
        if (type.indexOf("serving") >= 0 || type.indexOf("access") >= 0) style.endDeco = "openTriangle";
        if (type.indexOf("realization") >= 0 || type.indexOf("specialization") >= 0) {
            style.endDeco = "openTriangle";
            if (!explicitDash) style.dash = "6 4";
        }
        if (type.indexOf("influence") >= 0) {
            style.endDeco = "openTriangle";
            if (!explicitDash) style.dash = "2 3";
        }
        if (type.indexOf("aggregation") >= 0) {
            style.startDeco = "openDiamond";
            style.endDeco = null;
        }
        if (type.indexOf("composition") >= 0) {
            style.startDeco = "filledDiamond";
            style.endDeco = null;
        }
        if (type.indexOf("flow") >= 0) style.endDeco = "openTriangle";
        if (type.indexOf("triggering") >= 0 || type.indexOf("assignment") >= 0) style.endDeco = "filledTriangle";
        return style;
    }

    function renderDecorations(points, stroke, lineWidth, styleSpec) {
        var out = "";
        if (!styleSpec) return out;
        if (styleSpec.endDeco) {
            var last = getLastSegment(points);
            if (last) {
                var vEnd = normalizeVec(last.to.x - last.from.x, last.to.y - last.from.y);
                if (styleSpec.endDeco === "openTriangle") out += drawTriangleDecoration(last.to, vEnd.x, vEnd.y, stroke, lineWidth, true);
                if (styleSpec.endDeco === "filledTriangle") out += drawTriangleDecoration(last.to, vEnd.x, vEnd.y, stroke, lineWidth, false);
            }
        }
        if (styleSpec.startDeco) {
            var first = getFirstSegment(points);
            if (first) {
                var vStart = normalizeVec(first.from.x - first.to.x, first.from.y - first.to.y);
                if (styleSpec.startDeco === "openDiamond") out += drawDiamondDecoration(first.from, vStart.x, vStart.y, stroke, lineWidth, false);
                if (styleSpec.startDeco === "filledDiamond") out += drawDiamondDecoration(first.from, vStart.x, vStart.y, stroke, lineWidth, true);
            }
        }
        return out;
    }

    var api = {
        getStyleByType: getStyleByType,
        renderDecorations: renderDecorations
    };

    if (typeof globalThis !== "undefined") {
        globalThis.archiRelationshipLibrary = api;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})();
