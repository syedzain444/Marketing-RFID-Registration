(function () {
    "use strict";

    var table = null;
    var roles = [];
    var cachedUsers = [];

    function root() {
        return window.RFID_APP_ROOT || "/";
    }

    function esc(text) {
        if (text == null) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function fetchJson(url, options) {
        return fetch(url, options || { credentials: "same-origin" }).then(function (res) {
            return res.text().then(function (text) {
                if (!res.ok) {
                    throw new Error("Server error (" + res.status + ").");
                }
                try {
                    return JSON.parse(text || "{}");
                } catch (e) {
                    throw new Error("Could not read server response.");
                }
            });
        });
    }

    function showAlert(message, isError) {
        var el = document.getElementById("usersAlert");
        if (!el) return;
        el.textContent = message || "";
        el.classList.toggle("is-hidden", !message);
        el.classList.toggle("is-error", !!isError);
    }

    function isActiveUser(u) {
        return !!(u.isActive !== undefined ? u.isActive : u.IsActive);
    }

    function statusPillHtml(u, interactive) {
        var active = isActiveUser(u);
        var id = esc(u.id || u.Id);
        var cls = "status-pill" + (active ? " status-pill--active" : "");
        var label = active ? "Active" : "Inactive";
        if (interactive) {
            return (
                '<button type="button" class="' + cls + ' status-pill-btn" data-id="' + id + '" data-active="' + (active ? "true" : "false") + '">' +
                label +
                "</button>"
            );
        }
        return '<span class="' + cls + '">' + label + "</span>";
    }

    function refreshUserPillBtn(btn, active) {
        if (!btn) return;
        btn.setAttribute("data-active", active ? "true" : "false");
        btn.classList.toggle("status-pill--active", active);
        btn.textContent = active ? "Active" : "Inactive";
    }

    function statusToggleCell(u) {
        if (document.body.classList.contains("dashboard-v2")) {
            return statusPillHtml(u, true);
        }
        var active = isActiveUser(u);
        var id = esc(u.id || u.Id);
        return (
            '<label class="status-switch' + (active ? " is-on" : "") + '" data-id="' + id + '" data-order="' + (active ? "1" : "0") + '">' +
            '<input type="checkbox" class="status-switch__input"' + (active ? " checked" : "") +
            ' aria-label="Set user ' + id + ' ' + (active ? "inactive" : "active") + '" />' +
            '<span class="status-switch__track" aria-hidden="true"><span class="status-switch__thumb"></span></span>' +
            '<span class="status-switch__label">' + (active ? "Active" : "Inactive") + "</span>" +
            "</label>"
        );
    }

    var svgEdit = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

    function avatarColor(name) {
        var h = 0;
        var s = String(name || "");
        for (var i = 0; i < s.length; i++) {
            h = s.charCodeAt(i) + ((h << 5) - h);
        }
        var colors = ["#0a7a62", "#2563eb", "#004d4d", "#e8882e", "#6d28d9", "#0891b2"];
        return colors[Math.abs(h) % colors.length];
    }

    function nameCell(name) {
        var n = (name || "").trim();
        if (!n || n === "—") return "—";
        var initial = n.charAt(0).toUpperCase();
        return (
            '<span class="user-chip">' +
            '<span class="user-chip__avatar" style="background:' + avatarColor(n) + '">' + esc(initial) + "</span>" +
            '<span class="user-chip__name">' + esc(n) + "</span></span>"
        );
    }

    function moveUsersDtToolbar() {
        var toolbar = document.getElementById("usersDtToolbar");
        if (!toolbar || !table) return;
        var $wrap = $("#usersTable").closest(".dataTables_wrapper");
        $wrap.find(".dataTables_length, .dataTables_filter").appendTo(toolbar);
        var $input = $wrap.find(".dataTables_filter input");
        if ($input.length) {
            $input.attr("placeholder", "Search by name, employee ID or role");
        }
    }

    function renderRows(users) {
        return (users || []).map(function (u) {
            var name = u.displayName || u.DisplayName || "—";
            return [
                esc(u.empId || u.EmpId || ""),
                nameCell(name),
                esc(u.roleName || u.RoleName || u.roleCode || ""),
                statusToggleCell(u),
                '<div class="records-actions">' +
                    '<button type="button" class="btn-edit btn-edit-user" data-id="' + esc(u.id || u.Id) + '">' + svgEdit + " Edit</button>" +
                "</div>"
            ];
        });
    }

    function initTable(rows) {
        var data = renderRows(rows);
        if (!table) {
            table = $("#usersTable").DataTable({
                data: data,
                order: [[0, "asc"]],
                pageLength: 15,
                lengthMenu: [[10, 15, 25, 50, -1], [10, 15, 25, 50, "All"]],
                language: {
                    search: "",
                    lengthMenu: "Show: _MENU_ rows",
                    info: "Showing _START_ to _END_ of _TOTAL_ users",
                    infoEmpty: "No users to show",
                    zeroRecords: "No matching users found",
                    paginate: { first: "«", last: "»", next: "›", previous: "‹" }
                },
                initComplete: function () {
                    moveUsersDtToolbar();
                },
                drawCallback: function () {
                    moveUsersDtToolbar();
                },
                columnDefs: [
                    { targets: [0], className: "rfid-mono" },
                    { targets: [3], className: "dt-status", orderable: false },
                    { targets: [4], className: "dt-actions", orderable: false }
                ]
            });
        } else {
            table.clear();
            table.rows.add(data);
            table.draw();
        }
        cachedUsers = rows || [];
        updateStats(cachedUsers);
    }

    function refreshSwitchUi(label) {
        if (!label) return;
        var input = label.querySelector(".status-switch__input");
        var text = label.querySelector(".status-switch__label");
        if (!input || !text) return;
        var on = input.checked;
        label.classList.toggle("is-on", on);
        text.textContent = on ? "Active" : "Inactive";
        label.setAttribute("data-order", on ? "1" : "0");
    }

    function syncCachedActive(id, isActive) {
        for (var i = 0; i < cachedUsers.length; i++) {
            if (String(cachedUsers[i].id || cachedUsers[i].Id) === String(id)) {
                cachedUsers[i].isActive = isActive;
                break;
            }
        }
        updateStats(cachedUsers);
    }

    function setUserActive(id, isActive, inputEl) {
        var body = new URLSearchParams();
        body.append("action", "setactive");
        body.append("id", id);
        body.append("isActive", isActive ? "true" : "false");

        return fetchJson(root() + "MarketingUsers.ashx", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        }).then(function (payload) {
            if (!payload || !payload.Ok) {
                throw new Error((payload && payload.Error) || "Unable to update status.");
            }
            syncCachedActive(id, isActive);
            showAlert("User is now " + (isActive ? "Active" : "Inactive") + ".", false);
        }).catch(function (err) {
            showAlert(err.message || "Failed to update status.", true);
            if (inputEl) {
                inputEl.checked = !isActive;
                refreshSwitchUi(inputEl.closest(".status-switch"));
            }
        });
    }

    function updateStats(users) {
        var total = users ? users.length : 0;
        var active = 0;
        if (users) {
            for (var i = 0; i < users.length; i++) {
                if (isActiveUser(users[i])) active++;
            }
        }
        var inactive = total - active;
        var elTotal = document.getElementById("statUsersTotal");
        var elActive = document.getElementById("statUsersActive");
        var elInactive = document.getElementById("statUsersInactive");
        if (elTotal) elTotal.textContent = total;
        if (elActive) elActive.textContent = active;
        if (elInactive) elInactive.textContent = inactive;
    }

    function loadUsers() {
        return fetchJson(root() + "MarketingUsers.ashx?action=list").then(function (payload) {
            if (!payload || !payload.Ok) {
                throw new Error((payload && payload.Error) || "Unable to load users.");
            }
            var users = (payload.Data && payload.Data.users) || [];
            initTable(users);
            return users;
        });
    }

    function loadRoles() {
        return fetchJson(root() + "MarketingUsers.ashx?action=roles").then(function (payload) {
            if (!payload || !payload.Ok) {
                throw new Error((payload && payload.Error) || "Unable to load roles.");
            }
            roles = (payload.Data && payload.Data.roles) || [];
            var sel = document.getElementById("userRole");
            if (!sel) return roles;
            sel.innerHTML = "";
            roles.forEach(function (r) {
                var opt = document.createElement("option");
                opt.value = r.code;
                opt.textContent = r.name + " (" + r.code + ")";
                sel.appendChild(opt);
            });
            return roles;
        });
    }

    function modalEl() {
        return document.getElementById("userModal");
    }

    function openModal(mode, user) {
        var modal = modalEl();
        if (!modal) return;
        var isEdit = mode === "edit";
        document.getElementById("userFormId").value = isEdit && user ? String(user.id) : "0";
        document.getElementById("userEmpId").value = isEdit && user ? (user.empId || "") : "";
        document.getElementById("userEmpId").readOnly = false;
        document.getElementById("userDisplayName").value = isEdit && user ? (user.displayName || "") : "";
        document.getElementById("userPassword").value = "";
        var roleSel = document.getElementById("userRole");
        if (roleSel && roles.length) {
            roleSel.value = isEdit && user && user.roleCode ? user.roleCode : roles[0].code;
        }
        var activeChk = document.getElementById("userActive");
        var on = !isEdit || !user || user.isActive !== false;
        if (activeChk) activeChk.checked = on;
        refreshActiveSwitch();

        document.getElementById("userModalTitle").textContent = isEdit ? "Edit user" : "New user";
        document.getElementById("userModalSub").textContent = isEdit && user
            ? (user.empId || "") + " · " + (user.roleName || user.roleCode || "")
            : "Create an APP_USERS_MARKETING account";
        document.getElementById("userPasswordHint").textContent = isEdit
            ? "Leave blank to keep current password"
            : "Required for new users";

        hideFormError();
        modal.classList.remove("is-hidden");
        document.body.classList.add("modal-open");
    }

    function closeModal() {
        var modal = modalEl();
        if (!modal) return;
        modal.classList.add("is-hidden");
        document.body.classList.remove("modal-open");
    }

    function hideFormError() {
        var el = document.getElementById("userFormError");
        if (el) {
            el.textContent = "";
            el.classList.add("is-hidden");
        }
    }

    function showFormError(msg) {
        var el = document.getElementById("userFormError");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.remove("is-hidden");
    }

    function refreshActiveSwitch() {
        var input = document.getElementById("userActive");
        var label = document.getElementById("userActiveSwitch");
        if (!input || !label) return;
        label.classList.toggle("is-on", input.checked);
        var text = label.querySelector(".status-switch__label");
        if (text) text.textContent = input.checked ? "Active" : "Inactive";
    }

    function saveUser() {
        var id = document.getElementById("userFormId").value || "0";
        var body = new URLSearchParams();
        body.append("action", "save");
        body.append("id", id);
        body.append("empId", document.getElementById("userEmpId").value || "");
        body.append("displayName", document.getElementById("userDisplayName").value || "");
        body.append("roleCode", document.getElementById("userRole").value || "");
        body.append("password", document.getElementById("userPassword").value || "");
        body.append("isActive", document.getElementById("userActive").checked ? "true" : "false");

        return fetchJson(root() + "MarketingUsers.ashx", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        }).then(function (payload) {
            if (!payload || !payload.Ok) {
                throw new Error((payload && payload.Error) || "Unable to save user.");
            }
            showAlert(id === "0" ? "User created." : "User updated.", false);
            closeModal();
            return loadUsers();
        }).catch(function (err) {
            showFormError(err.message || "Save failed.");
        });
    }

    function bindEvents() {
        $("#btnNewUser").on("click", function () {
            openModal("new");
        });
        $("#btnRefreshUsers").on("click", function () {
            loadUsers().catch(function (err) {
                showAlert(err.message, true);
            });
        });
        $("#usersTable").on("change", ".status-switch__input", function () {
            var input = this;
            var label = input.closest(".status-switch");
            var id = label && label.getAttribute("data-id");
            if (!id) return;
            var next = input.checked;
            refreshSwitchUi(label);
            setUserActive(id, next, input);
        });

        $("#usersTable").on("click", ".status-pill-btn", function () {
            var btn = this;
            if (btn.disabled) return;
            var id = btn.getAttribute("data-id");
            if (!id) return;
            var wasActive = btn.getAttribute("data-active") === "true";
            var next = !wasActive;
            btn.disabled = true;
            setUserActive(id, next, null)
                .then(function () {
                    refreshUserPillBtn(btn, next);
                })
                .catch(function () {
                    refreshUserPillBtn(btn, wasActive);
                })
                .finally(function () {
                    btn.disabled = false;
                });
        });

        $("#usersTable").on("click", ".btn-edit-user", function () {
            var id = this.getAttribute("data-id");
            fetchJson(root() + "MarketingUsers.ashx?action=get&id=" + encodeURIComponent(id))
                .then(function (payload) {
                    if (!payload || !payload.Ok) {
                        throw new Error((payload && payload.Error) || "Unable to load user.");
                    }
                    openModal("edit", payload.Data);
                })
                .catch(function (err) {
                    showAlert(err.message, true);
                });
        });

        ["userModalClose", "userModalCloseFoot", "userModalBackdrop"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("click", closeModal);
        });

        document.getElementById("btnSaveUser").addEventListener("click", saveUser);
        document.getElementById("userActive").addEventListener("change", refreshActiveSwitch);

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && modalEl() && !modalEl().classList.contains("is-hidden")) {
                closeModal();
            }
        });
    }

    $(function () {
        if (!document.getElementById("usersTable")) return;
        bindEvents();
        Promise.all([loadRoles(), loadUsers()]).catch(function (err) {
            showAlert(err.message, true);
        });
    });
})();
