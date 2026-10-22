<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Default.aspx.cs" Inherits="RFID_Marketing_Form._Default" ClientIDMode="Static" %>
<%@ Register Src="~/Controls/MarketingSidebar.ascx" TagPrefix="uc" TagName="MarketingSidebar" %>

<!DOCTYPE html>
<html lang="en">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RFID Card Request</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link href="Content/marketing-sidebar.css?v=4" rel="stylesheet" />
    <link href="Content/marketing-wide.css?v=1" rel="stylesheet" />
    <link href="Content/rfid.css" rel="stylesheet" />
</head>
<body class="marketing-app">
    <form id="form1" runat="server" autocomplete="off" enctype="multipart/form-data" class="marketing-shell">
        <uc:MarketingSidebar runat="server" ID="marketingSidebar" />
        <div class="marketing-main">
        <header class="topbar">
            <div class="brand">
                <span class="mark" aria-hidden="true">
                    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="9" width="22" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
                        <path d="M5 13h22" stroke="currentColor" stroke-width="1.6"/>
                        <path d="M16 6c3 1.2 5 3.4 5.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                        <path d="M16 6c-3 1.2-5 3.4-5.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    </svg>
                </span>
                <span class="brand-divider" aria-hidden="true"></span>
                <div class="brand-text">
                    <h1>RFID Card Request</h1>
                    <p class="subtitle">Create or update an employee access card record.</p>
                </div>
            </div>
            <div class="actions">
                <button type="button" id="btnClear" class="btn btn-ghost">Clear</button>
                <asp:Button ID="btnSave" runat="server" Text="Save Record" CssClass="btn btn-primary btn-icon-save" OnClick="btnSave_Click" OnClientClick="return RfidForm.validateBeforeSubmit();" />
            </div>
        </header>

        <main class="shell">
            <div class="layout">
                <div class="workspace">
                    <section class="status-card field" data-field="status">
                        <span class="status-card__label">Status</span>
                        <asp:RadioButtonList ID="rblStatus" runat="server" RepeatLayout="Flow" CssClass="pills pills-segment pills--choice">
                            <asp:ListItem Value="Active" Selected="True">Active</asp:ListItem>
                            <asp:ListItem Value="Inactive">Inactive</asp:ListItem>
                        </asp:RadioButtonList>
                    </section>

                    <div class="form-matrix">
                        <section class="card-panel">
                            <h2 class="card-panel__title">Employee &amp; Card Details</h2>
                            <div class="fields fields-4">
                                <div class="field" data-field="emp">
                                    <label for="txtEmpId">Employee ID <span class="req">*</span></label>
                                    <div class="input-shell input-shell--user">
                                        <asp:TextBox ID="txtEmpId" runat="server" MaxLength="20" CssClass="input-control" placeholder="e.g. 10428" />
                                    </div>
                                </div>
                                <div class="field" data-field="grade">
                                    <label for="txtGrade">Grade</label>
                                    <div class="input-shell input-shell--select">
                                        <asp:TextBox ID="txtGrade" runat="server" MaxLength="30" CssClass="input-control" placeholder="Optional" />
                                    </div>
                                </div>
                                <div class="field span-4" data-field="photo">
                                    <label for="txtPhotoPath">Photo path <span class="tag-opt">optional</span></label>
                                    <div class="photo-path-row">
                                        <div class="input-shell input-shell--plain photo-path-row__input">
                                            <asp:TextBox ID="txtPhotoPath" runat="server" MaxLength="500" CssClass="input-control input-control--readonly" placeholder="Use Browse to select a photo" ReadOnly="true" />
                                        </div>
                                        <label class="photo-path-row__browse">
                                            Browse
                                            <input type="file" id="filePhotoPick" name="employeePhoto" class="photo-path-row__file" accept="image/*" />
                                        </label>
                                    </div>
                                </div>
                                <div class="field" data-field="cardName">
                                    <label for="txtCardName">Name</label>
                                    <div class="input-shell input-shell--user">
                                        <asp:TextBox ID="txtCardName" runat="server" MaxLength="100" CssClass="input-control" placeholder="Full name" />
                                    </div>
                                </div>
                                <div class="field" data-field="designation">
                                    <label for="txtDesignation">Designation</label>
                                    <div class="input-shell input-shell--briefcase">
                                        <asp:TextBox ID="txtDesignation" runat="server" MaxLength="100" CssClass="input-control" placeholder="Job title" />
                                    </div>
                                </div>
                                <div class="field" data-field="department">
                                    <label for="txtDepartment">Department</label>
                                    <div class="input-shell input-shell--building">
                                        <asp:TextBox ID="txtDepartment" runat="server" MaxLength="100" CssClass="input-control" placeholder="Department" />
                                    </div>
                                </div>
                                <div class="field" data-field="project">
                                    <label for="txtProject">Project / Location</label>
                                    <div class="input-shell input-shell--pin">
                                        <asp:TextBox ID="txtProject" runat="server" MaxLength="100" CssClass="input-control" placeholder="Site" />
                                    </div>
                                </div>
                                <div class="field" data-field="joining">
                                    <label for="txtJoiningDate">Joining date</label>
                                    <div class="input-shell input-shell--date">
                                        <asp:TextBox ID="txtJoiningDate" runat="server" TextMode="Date" CssClass="input-control" />
                                    </div>
                                </div>
                                <div class="field" data-field="bloodGroup">
                                    <label for="txtBloodGroup">Blood group</label>
                                    <div class="input-shell input-shell--plain">
                                        <asp:TextBox ID="txtBloodGroup" runat="server" MaxLength="20" CssClass="input-control" placeholder="e.g. O+" />
                                    </div>
                                </div>
                                <div class="field" data-field="cnic">
                                    <label for="txtCnic">CNIC</label>
                                    <div class="input-shell input-shell--plain">
                                        <asp:TextBox ID="txtCnic" runat="server" MaxLength="20" CssClass="input-control" placeholder="12345-1234567-1" />
                                    </div>
                                </div>
                                <div class="field" data-field="emergencyNo">
                                    <label for="txtEmergencyNo">Emergency #</label>
                                    <div class="input-shell input-shell--plain">
                                        <asp:TextBox ID="txtEmergencyNo" runat="server" MaxLength="30" CssClass="input-control" placeholder="Contact number" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="card-panel">
                            <h2 class="card-panel__title">Issue &amp; Validity</h2>
                            <div class="fields fields-issue">
                                <div class="field" data-field="issue">
                                    <label for="txtIssueDate">Issue date <span class="req">*</span></label>
                                    <div class="input-shell input-shell--date">
                                        <asp:TextBox ID="txtIssueDate" runat="server" TextMode="Date" CssClass="input-control" />
                                    </div>
                                </div>
                                <div class="field" data-field="expiry">
                                    <label for="txtExpiryDate">Expiry date <span class="req cond" data-cond="expiry">*</span></label>
                                    <div class="input-shell input-shell--date">
                                        <asp:TextBox ID="txtExpiryDate" runat="server" TextMode="Date" CssClass="input-control input-control--readonly" ReadOnly="true" aria-readonly="true" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="card-panel">
                            <h2 class="card-panel__title">HOD Review</h2>
                            <div class="fields fields-review">
                                <div class="field" data-field="forward">
                                    <span class="label">Forward to HOD</span>
                                    <asp:RadioButtonList ID="rblForward" runat="server" RepeatLayout="Flow" CssClass="pills pills-segment pills-compact pills--choice">
                                        <asp:ListItem Value="N" Selected="True">No</asp:ListItem>
                                        <asp:ListItem Value="Y">Yes</asp:ListItem>
                                    </asp:RadioButtonList>
                                </div>
                                <div class="field" data-field="forwardBy">
                                    <label for="txtForwardBy">Forwarded by <span class="req cond" data-cond="forward">*</span></label>
                                    <div class="input-shell input-shell--user">
                                        <asp:TextBox ID="txtForwardBy" runat="server" MaxLength="100" CssClass="input-control" placeholder="Name" />
                                    </div>
                                </div>
                                <div class="field" data-field="forwardOn">
                                    <label for="txtForwardOn">Forwarded on <span class="req cond" data-cond="forward">*</span></label>
                                    <div class="input-shell input-shell--date">
                                        <asp:TextBox ID="txtForwardOn" runat="server" TextMode="Date" CssClass="input-control" />
                                    </div>
                                </div>
                                <div class="field field-remarks span-3" data-field="hod">
                                    <label for="txtHodRemarks">HOD remarks <span class="counter" id="hodCount">0/500</span></label>
                                    <asp:TextBox ID="txtHodRemarks" runat="server" TextMode="MultiLine" Rows="2" MaxLength="500" CssClass="input-textarea" placeholder="Optional notes from HOD" />
                                </div>
                            </div>
                        </section>

                        <section class="card-panel">
                            <h2 class="card-panel__title">Approval &amp; Remarks</h2>
                            <div class="fields fields-review">
                                <div class="field" data-field="approved">
                                    <span class="label">Approved</span>
                                    <asp:RadioButtonList ID="rblApproved" runat="server" RepeatLayout="Flow" CssClass="pills pills-segment pills-compact pills--choice">
                                        <asp:ListItem Value="Y">Yes</asp:ListItem>
                                        <asp:ListItem Value="N" Selected="True">No</asp:ListItem>
                                    </asp:RadioButtonList>
                                </div>
                                <div class="field" data-field="approvedDate">
                                    <label for="txtApprovedDate">Approved date <span class="req cond" data-cond="approved">*</span></label>
                                    <div class="input-shell input-shell--date">
                                        <asp:TextBox ID="txtApprovedDate" runat="server" TextMode="Date" CssClass="input-control" />
                                    </div>
                                </div>
                                <div class="field" data-field="approveId">
                                    <label for="txtApproveId">Approver ID</label>
                                    <div class="input-shell input-shell--doc">
                                        <asp:TextBox ID="txtApproveId" runat="server" MaxLength="10" CssClass="input-control" inputmode="numeric" placeholder="Numeric ID" />
                                    </div>
                                </div>
                                <div class="field field-remarks span-3" data-field="remarks">
                                    <label for="txtRequesterRemarks">Requester remarks <span class="counter" id="remarksCount">0/500</span></label>
                                    <asp:TextBox ID="txtRequesterRemarks" runat="server" TextMode="MultiLine" Rows="2" MaxLength="500" CssClass="input-textarea" placeholder="Who asked, and why" />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <aside class="aside">
                    <section class="sidebar-card profile-preview" id="passCard" aria-live="polite">
                        <h2 class="sidebar-card__title">Employee Profile</h2>
                        <div class="profile-preview__layout">
                            <div class="profile-preview__photo-wrap">
                                <asp:Image ID="imgEmpPhoto" runat="server" AlternateText="Employee photo" CssClass="profile-preview__photo is-hidden" />
                                <span id="passPhotoPlaceholder" class="profile-preview__photo-empty">Photo unavailable</span>
                            </div>
                            <dl class="profile-preview__details">
                                <div class="profile-preview__row"><dt>Employee ID</dt><dd><asp:Label ID="lblEmpID" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Name</dt><dd><asp:Label ID="lblName" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Designation</dt><dd><asp:Label ID="lblDesignation" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Department</dt><dd><asp:Label ID="lblDepartment" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Project</dt><dd><asp:Label ID="lblProject" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Joining</dt><dd><asp:Label ID="lblJoiningDate" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Blood group</dt><dd><asp:Label ID="lblBloodGroup" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>CNIC</dt><dd><asp:Label ID="lblCnic" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Emergency #</dt><dd><asp:Label ID="lblEmergencyNo" runat="server" Text="—" /></dd></div>
                                <div class="profile-preview__row"><dt>Grade</dt><dd><asp:Label ID="lblGradeBadge" runat="server" Text="—" /></dd></div>
                            </dl>
                        </div>
                    </section>

                    <section class="sidebar-card meter">
                        <div class="meter-row">
                            <span class="meter-title">Before you can save</span>
                            <strong id="meterCount">0 of 4 done</strong>
                        </div>
                        <div class="meter-seg" id="meterSeg" aria-hidden="true">
                            <span></span><span></span><span></span><span></span>
                        </div>
                        <ul class="checks checks--grid" id="checkList">
                            <li data-check="emp"><span class="check-ico" aria-hidden="true"></span>Employee ID</li>
                            <li data-check="status"><span class="check-ico" aria-hidden="true"></span>Status</li>
                            <li data-check="issue"><span class="check-ico" aria-hidden="true"></span>Issue date</li>
                            <li data-check="extra"><span class="check-ico" aria-hidden="true"></span>HOD &amp; approval</li>
                        </ul>
                        <button type="button" id="btnSaveAside" runat="server" class="btn btn-primary btn-icon-save btn-save-aside">Save record</button>
                    </section>

                </aside>
            </div>
        </main>
        <div id="captchaModal" class="captcha-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="captchaTitle">
            <div class="captcha-modal__backdrop" id="captchaBackdrop"></div>
            <div class="captcha-modal__box">
                <h3 id="captchaTitle" class="captcha-modal__title">Verify before saving</h3>
                <p class="captcha-modal__sub">Answer the question below to submit this record.</p>
                <p class="captcha-modal__question" id="captchaQuestion">—</p>
                <label class="captcha-modal__label" for="captchaInput">Your answer</label>
                <input type="text" id="captchaInput" class="captcha-modal__input" inputmode="numeric" autocomplete="off" maxlength="3" />
                <p id="captchaError" class="captcha-modal__error" hidden></p>
                <div class="captcha-modal__actions">
                    <button type="button" class="btn btn-ghost" id="captchaCancel">Cancel</button>
                    <button type="button" class="btn btn-primary btn-icon-save" id="captchaConfirm">Save Record</button>
                </div>
            </div>
        </div>
        </div>
        <script>window.RFID_APP_ROOT = '<%= ResolveUrl("~/") %>';</script>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script src="Scripts/rfid-photos.js"></script>
        <script src="Scripts/rfid-form.js?v=4"></script>
    </form>
</body>
</html>
