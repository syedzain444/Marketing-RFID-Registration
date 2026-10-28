window.RfidPhotos = (function () {
    "use strict";

    function appRoot() {
        var root = window.RFID_APP_ROOT || "/";
        if (root.charAt(root.length - 1) !== "/") {
            root += "/";
        }
        return root;
    }

    function employeeImageUrlTemplate() {
        var tpl = window.RFID_EMPLOYEE_IMAGE_URL;
        if (tpl && String(tpl).trim()) {
            return String(tpl).trim();
        }
        return "http://172.16.10.54/EImages/EImages/{id}.jpg";
    }

    function normalizeEmpId(empId) {
        return String(empId == null ? "" : empId).trim();
    }

    /** Same-origin proxy (server pulls HR EImages) — works in PDF/html2canvas. */
    function employeeImageUrl(empId) {
        var id = normalizeEmpId(empId);
        if (!id) {
            return "";
        }
        return appRoot() + "EmpHrPhoto.ashx?empId=" + encodeURIComponent(id);
    }

    /** Direct HR URL (browser display only; not for canvas/PDF). */
    function employeeImageDirectUrl(empId) {
        var id = normalizeEmpId(empId);
        if (!id) {
            return "";
        }
        return employeeImageUrlTemplate().replace(/\{id\}/gi, encodeURIComponent(id));
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
        if (/^https?:\/\//i.test(p)) return p;
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

    /** Employee cards: HR image server first, uploaded/stored path as fallback. */
    function employeePhotoUrls(path, empId) {
        var primary = employeeImageUrl(empId);
        var p = normalizeRelative(path);
        var fallback = "";
        if (p) {
            fallback = /^https?:\/\//i.test(p) ? p : displayUrl(p);
        }
        if (primary) {
            return { primary: primary, fallback: fallback };
        }
        return { primary: fallback, fallback: handlerUrl(path) || "" };
    }

    return {
        appRoot: appRoot,
        publicUrl: publicUrl,
        handlerUrl: handlerUrl,
        displayUrl: displayUrl,
        employeeImageUrl: employeeImageUrl,
        employeeImageDirectUrl: employeeImageDirectUrl,
        employeePhotoUrls: employeePhotoUrls,
        uploadFile: uploadFile
    };
})();
