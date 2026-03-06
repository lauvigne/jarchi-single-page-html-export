(function() {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.diagramAppearancePrefs !== "undefined") {
        return;
    }

    function safeString(value) {
        if (value === null || value === undefined) return "";
        return String(value);
    }

    function safeCall(fn, fallback) {
        try {
            var value = fn();
            return value === undefined ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function tryJavaType(name) {
        return safeCall(function() { return Java.type(name); }, null);
    }

    function readPreferencesTree(node, path, maxDepth) {
        var out = {
            path: path,
            keys: {},
            children: {}
        };

        var keys = safeCall(function() { return Java.from(node.keys()); }, []);
        keys.forEach(function(key) {
            out.keys[key] = safeCall(function() { return node.get(key, null); }, null);
        });

        if (maxDepth <= 0) return out;

        var children = safeCall(function() { return Java.from(node.childrenNames()); }, []);
        children.forEach(function(childName) {
            var childNode = safeCall(function() { return node.node(childName); }, null);
            if (childNode) {
                out.children[childName] = readPreferencesTree(childNode, path + "/" + childName, maxDepth - 1);
            }
        });

        return out;
    }

    function flattenTree(tree, scope, pluginId, outEntries) {
        Object.keys(tree.keys || {}).forEach(function(key) {
            outEntries.push({
                scope: scope,
                pluginId: pluginId,
                path: tree.path,
                key: key,
                value: tree.keys[key]
            });
        });

        Object.keys(tree.children || {}).forEach(function(childName) {
            flattenTree(tree.children[childName], scope, pluginId, outEntries);
        });
    }

    function getScopeDescriptors() {
        var scopes = [];
        var InstanceScope = tryJavaType("org.eclipse.core.runtime.preferences.InstanceScope");
        var DefaultScope = tryJavaType("org.eclipse.core.runtime.preferences.DefaultScope");
        var ConfigurationScope = tryJavaType("org.eclipse.core.runtime.preferences.ConfigurationScope");

        if (InstanceScope && InstanceScope.INSTANCE) {
            scopes.push({ name: "instance", scopeObject: InstanceScope.INSTANCE });
        }
        if (DefaultScope && DefaultScope.INSTANCE) {
            scopes.push({ name: "default", scopeObject: DefaultScope.INSTANCE });
        }
        if (ConfigurationScope && ConfigurationScope.INSTANCE) {
            scopes.push({ name: "configuration", scopeObject: ConfigurationScope.INSTANCE });
        }

        return scopes;
    }

    function defaultPluginIds() {
        return [
            "com.archimatetool.editor",
            "com.archimatetool.editor.diagram",
            "com.archimatetool.editor.preferences",
            "com.archimatetool.help",
            "com.archimatetool.model"
        ];
    }

    function detectInterestingEntries(entries) {
        var patterns = [
            /word.?wrap/i,
            /text.?position/i,
            /label.?position/i,
            /text.?align/i,
            /font/i,
            /line.?style/i,
            /line.?width/i,
            /gradient/i,
            /default.?figure/i,
            /default.?width/i,
            /default.?height/i,
            /appearance/i
        ];

        return entries.filter(function(entry) {
            var haystack = entry.path + "|" + entry.key + "|" + safeString(entry.value);
            return patterns.some(function(re) { return re.test(haystack); });
        });
    }

    function collect(options) {
        var opts = options || {};
        var pluginIds = opts.pluginIds || defaultPluginIds();
        var maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : 4;
        var scopes = getScopeDescriptors();

        var result = {
            generatedAt: safeString(new Date()),
            pluginIds: pluginIds,
            scopes: [],
            flattened: [],
            interesting: []
        };

        scopes.forEach(function(scopeInfo) {
            var scopeSnapshot = {
                scope: scopeInfo.name,
                plugins: {}
            };

            pluginIds.forEach(function(pluginId) {
                var node = safeCall(function() { return scopeInfo.scopeObject.getNode(pluginId); }, null);
                if (!node) return;
                var tree = readPreferencesTree(node, pluginId, maxDepth);
                scopeSnapshot.plugins[pluginId] = tree;
                flattenTree(tree, scopeInfo.name, pluginId, result.flattened);
            });

            result.scopes.push(scopeSnapshot);
        });

        result.interesting = detectInterestingEntries(result.flattened);
        return result;
    }

    function getFirstValue(result, keyRegex) {
        var re = keyRegex instanceof RegExp ? keyRegex : new RegExp(String(keyRegex), "i");
        var match = (result.interesting || result.flattened || []).find(function(entry) {
            return re.test(entry.key) || re.test(entry.path);
        });
        return match ? match.value : null;
    }

    function summarize(result) {
        return {
            wordWrapStyle: getFirstValue(result, /word.?wrap/i),
            textPosition: getFirstValue(result, /text.?position/i),
            textAlignment: getFirstValue(result, /text.?align/i),
            labelPosition: getFirstValue(result, /label.?position/i),
            lineStyle: getFirstValue(result, /line.?style/i),
            lineWidth: getFirstValue(result, /line.?width/i)
        };
    }

    var api = {
        collect: collect,
        summarize: summarize,
        getFirstValue: getFirstValue
    };

    if (typeof globalThis !== "undefined") {
        globalThis.diagramAppearancePrefs = api;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})();
