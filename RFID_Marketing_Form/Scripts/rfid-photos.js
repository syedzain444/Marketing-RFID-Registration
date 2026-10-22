window.RfidPhotos = (function () {
    "use strict";

    function appRoot() {
        var root = window.RFID_APP_ROOT || "/";
        if (root.charAt(root.length - 1) !== "/") {
            root += "/";
        }
        return root;
    }

    function normalizeRelative(path) {
        if (!path) return "";
        var p = String(path).trim();
        if (/^https?:\/\//i.test(p)) return p;
        return p.replace(/\\/g, "/").replace(/^\/+/, "");
    }

    function publicUrl(path) {
        var p = normalizeRelative(path);
        if (!p) return "";
        if (/^https?:\/\//i.test(p)) return p;
        var parts = p.split("/");
        for (var i = 0; i < parts.length; i++) {
            parts[i] = encodeURIComponent(parts[i]);
        }
        return appRoot() + parts.join("/");
    }

    function handlerUrl(path) {
        var p = normalizeRelative(path);
        if (!p) return "";
        return appRoot() + "EmpPhoto.ashx?p=" + encodeURIComponent(p);
    }

    function normalizeCategory(category) {
        return category === "family" ? "family" : "employee";
    }

    function uploadFile(file, options) {
        options = options || {};
        var category = normalizeCategory(options.category);
        var fd = new FormData();
        fd.append("file", file);
        fd.append("category", category);
        return fetch(appRoot() + "PhotoUpload.ashx", { method: "POST", body: fd, credentials: "same-origin" })
            .then(function (res) {
                return res.json();
            });
    }

    function displayUrl(path) {
        return handlerUrl(path) || publicUrl(path);
    }

    return {
        appRoot: appRoot,
        publicUrl: publicUrl,
        handlerUrl: handlerUrl,
        displayUrl: displayUrl,
        uploadFile: uploadFile
    };
})();
