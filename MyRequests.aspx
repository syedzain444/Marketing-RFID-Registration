<%@ Page Language="C#" AutoEventWireup="true" CodeFile="MyRequests.aspx.cs" Inherits="EmployeeCardSystem.MyRequests" %>

<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head id="Head1" runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Requests | Employee Card System</title>
    <link href="Style.css" rel="stylesheet" />
    <link href="RFID_Marketing_Form/Site.css" rel="stylesheet" />
    <link href="MyRequests.css" rel="stylesheet" />
</head>
<body>
    <!-- 1. ADDED enctype="multipart/form-data" FOR FILE UPLOAD -->
    <form id="form1" runat="server" enctype="multipart/form-data">

        <asp:HiddenField ID="hfKeepRfid" runat="server" Value="0" />

        <div class="topbar no-print">
            <div class="topbar-inner">
                <div class="brand">
                    <div class="brand-logo">
                        <img src="images/logo.png" alt="Bahria" />
                    </div>
                    <div class="brand-text">
                        <h2>Bahria Town</h2>
                        <span>Employee ID Card System</span>
                    </div>
                </div>
                <div class="topbar-right">
                    <span class="user-badge"><asp:Label ID="lblUserTop" runat="server" /></span>
                    <asp:Button ID="btnSearch" runat="server" Text="🔍 Search & Request" CssClass="btn-topnav" OnClick="btnSearch_Click" />
                    <asp:Button ID="btnLogout" runat="server" Text="Logout" CssClass="btn-logout" OnClick="btnLogout_Click" />
                </div>
            </div>
        </div>

        <div class="page-wrapper">
            
            <!-- TABS NAVIGATION -->
            <div class="tabs-nav">
                <asp:Button ID="btnTabEmp" runat="server" Text="Employee Cards" CssClass="tab-btn active-tab" OnClick="btnTabEmp_Click" CausesValidation="false" />
                <asp:Button ID="btnTabFam" runat="server" Text="Family Cards" CssClass="tab-btn" OnClick="btnTabFam_Click" CausesValidation="false" />
            </div>
            <asp:Panel ID="pnlMsg" runat="server" Visible="false" CssClass="alert alert-success" style="margin-top: 15px;">
                <span class="alert-icon">✓</span>
                <asp:Label ID="lblMsg" runat="server" />
            </asp:Panel>

            <asp:MultiView ID="mvMyRequests" runat="server" ActiveViewIndex="0">
                
                <!-- TAB 1: EMPLOYEE CARDS (Unchanged) -->
                <asp:View ID="vwEmpRequests" runat="server">
                    <div class="page-title-bar" style="margin-top: 10px;">
                        <h1>📋 Employee Card Requests</h1>
                        <p>All employee card requests forwarded to HOD</p>
                    </div>


                    <div class="requests-panel">
                        <asp:GridView ID="gvMyRequests" runat="server" AutoGenerateColumns="false"
                            CssClass="requests-grid" GridLines="None" DataKeyNames="ID"
                            OnRowCommand="gvMyRequests_RowCommand">
                            <Columns>
                                <asp:BoundField DataField="ID" HeaderText="Req ID" />
                                <asp:BoundField DataField="EMP_ID" HeaderText="Emp ID" />
                                <asp:BoundField DataField="ENAME" HeaderText="Name" />
                                <asp:BoundField DataField="DGN_NM" HeaderText="Designation" />
                                <asp:BoundField DataField="FORWARD_HOD_BY" HeaderText="Forwarded By" />
                                <asp:BoundField DataField="FORWARD_ON" HeaderText="Forwarded On" />
                                <asp:BoundField DataField="REQUESTER_REMARKS" HeaderText="Requester Remarks" />
                                <asp:BoundField DataField="STATUS" HeaderText="Status" />
                                <asp:BoundField DataField="HOD_REMARKS" HeaderText="HOD Remarks" />
                                <asp:BoundField DataField="RFID_NUMBER" HeaderText="RFID" />
                                <asp:BoundField DataField="PRINT_DATE" HeaderText="Printed On" />
                                <asp:TemplateField HeaderText="Action">
                                    <ItemTemplate>
                                        <div class="grid-actions">
                                            <asp:Button ID="btnViewDetails" runat="server" Text="View details"
                                                CssClass="btn-mini btn-mini-view"
                                                CommandName="ViewDetails"
                                                CommandArgument='<%# Eval("ID") %>' />
                                            <asp:Button ID="btnPrintCard" runat="server" Text="Print Card"
                                                CssClass="btn-mini btn-mini-card"
                                                CommandName="PrintCard"
                                                CommandArgument='<%# Eval("ID") %>' />
                                            <asp:Button ID="btnAssign" runat="server" Text="🖨 Assign RFID & Print"
                                                CssClass="btn-mini btn-mini-print"
                                                CommandName="AssignRFID"
                                                CommandArgument='<%# Eval("ID") %>'
                                                Visible='<%# Eval("STATUS").ToString() == "APPROVED" %>' />
                                        </div>
                                    </ItemTemplate>
                                </asp:TemplateField>
                            </Columns>
                            <EmptyDataTemplate>
                                <div class="empty-msg">No employee requests found. Go to Search & Request to forward one.</div>
                            </EmptyDataTemplate>
                        </asp:GridView>
                    </div>
                </asp:View>

                <!-- TAB 2: FAMILY CARDS (Updated Action Column & RowCommand) -->
                <asp:View ID="vwFamRequests" runat="server">
                    <div class="page-title-bar" style="margin-top: 10px;">
                        <h1>👨‍👩‍👧‍👦 Family Card Requests</h1>
                        <p>All family card requests forwarded to HOD</p>
                    </div>

                    <div class="requests-panel">
                        <!-- 2. ADDED OnRowCommand="gvFamilyRequests_RowCommand" -->
                        <asp:GridView ID="gvFamilyRequests" runat="server" AutoGenerateColumns="false"
                            CssClass="requests-grid" GridLines="None" DataKeyNames="ID"
                            OnRowCommand="gvFamilyRequests_RowCommand">
                            <Columns>
                                <asp:BoundField DataField="ID" HeaderText="Req ID" />
                                <asp:BoundField DataField="EMP_ID" HeaderText="Emp ID" />
                                <asp:BoundField DataField="ENAME" HeaderText="Employee Name" />
                                <asp:BoundField DataField="DEP_NAME" HeaderText="Dependent Name" />
                                <asp:BoundField DataField="DEP_CNIC" HeaderText="Dependent CNIC" />
                                <asp:BoundField DataField="FORWARD_HOD_BY" HeaderText="Forwarded By" />
                                <asp:BoundField DataField="FORWARD_ON" HeaderText="Forwarded On" />
                                <asp:BoundField DataField="STATUS" HeaderText="Status" />
                                <asp:BoundField DataField="HOD_REMARKS" HeaderText="HOD Remarks" />
                                <asp:TemplateField HeaderText="Action">
                                    <ItemTemplate>
                                        <!-- Show Upload Photo if APPROVED and NO image exists -->
                                        <asp:Button ID="btnUploadPhoto" runat="server" Text="📷 Upload Photo"
                                            CssClass="btn-mini btn-mini-view" CommandName="UploadPhoto"
                                            CommandArgument='<%# Eval("ID") %>'
                                            Visible='<%# Eval("STATUS").ToString() == "APPROVED" && string.IsNullOrEmpty(Eval("IMAGE_PATH").ToString()) %>' />

                                        <!-- Show Assign RFID & Print if APPROVED and image EXISTS -->
                                       <asp:Button ID="btnFamPrint" runat="server" Text="🖨 Assign RFID & Print"
                                            CssClass="btn-mini btn-mini-print" CommandName="AssignFamRFID"
                                            CommandArgument='<%# Eval("ID") %>'
                                            Visible='<%# Eval("STATUS").ToString() == "APPROVED" && !string.IsNullOrEmpty(Eval("IMAGE_PATH").ToString()) %>' />

                                        <asp:Label ID="Label2" runat="server" Text="—" Visible='<%# Eval("STATUS").ToString() != "APPROVED" %>' />
                                    </ItemTemplate>
                                </asp:TemplateField>
                            </Columns>
                            <EmptyDataTemplate>
                                <div class="empty-msg">No family requests found. Go to Search & Request to forward one.</div>
                            </EmptyDataTemplate>
                        </asp:GridView>
                    </div>
                </asp:View>

            </asp:MultiView>
        </div>

        <!-- ============================================================ -->
        <!-- HIDDEN PRINT PANEL (Unchanged)                                -->
        <!-- ============================================================ -->
        <asp:Panel ID="pnlPrint" runat="server" CssClass="pnl-print-wrapper">
            <!-- ========== PAGE 1 : FRONT CARD ========== -->
            <div class="print-page print-page-front">
                <div class="card-container">
                    <div class="id-card front-card">
                        <div class="front-header">
                            <div class="header-logo">
                                <asp:Image ID="imgLogo" runat="server" ImageUrl="~/RFID_Marketing_Form/Images/logo.png" AlternateText="Bahria Logo" />
                            </div>
                            <div class="header-photo">
                                <asp:Image ID="imgEmpPhoto" runat="server" AlternateText="Employee Photo" />
                            </div>
                        </div>
                        <div class="front-body">
                            <div class="field-group">
                                <span class="field-label">Employee ID:</span>
                                <span class="field-value emp-id"><asp:Label ID="lblEmpID" runat="server" /></span>
                            </div>
                            <div class="field-group">
                                <span class="field-label">Name :</span>
                                <span class="field-value"><asp:Label ID="lblName" runat="server" /></span>
                            </div>
                            <div class="field-group">
                                <span class="field-label">Designation:</span>
                                <span class="field-value"><asp:Label ID="lblDesignation" runat="server" /></span>
                            </div>
                            <div class="field-group">
                                <span class="field-label">Department:</span>
                                <span class="field-value"><asp:Label ID="lblDepartment" runat="server" /></span>
                            </div>
                            <div class="field-group">
                                <span class="field-label">Project/Location:</span>
                                <span class="field-value"><asp:Label ID="lblProject" runat="server" /></span>
                            </div>
                        </div>
                        <div class="grade-badge">
                            <asp:Label ID="lblGradeBadge" runat="server" Text="EMPLOYEE" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========== PAGE 2 : BACK CARD ========== -->
            <div class="print-page print-page-back">
                <div class="card-container">
                    <div class="id-card back-card">
                        <div class="back-details">
                            <div class="back-row">
                                <span class="back-label">Joining Date:</span>
                                <span class="back-value"><asp:Label ID="lblJoiningDate" runat="server" /></span>
                            </div>
                            <div class="back-row">
                                <span class="back-label">Issue Date:</span>
                                <span class="back-value"><asp:Label ID="lblIssueDate" runat="server" /></span>
                            </div>
                            <div class="back-row">
                                <span class="back-label">Expiry Date:</span>
                                <span class="back-value"><asp:Label ID="lblExpiryDate" runat="server" /></span>
                            </div>
                            <div class="back-row">
                                <span class="back-label">Blood Group:</span>
                                <span class="back-value"><asp:Label ID="lblBloodGroup" runat="server" /></span>
                            </div>
                            <div class="back-row">
                                <span class="back-label">CNIC:</span>
                                <span class="back-value"><asp:Label ID="lblCNICBack" runat="server" /></span>
                            </div>
                            <div class="back-row">
                                <span class="back-label">Emergency #:</span>
                                <span class="back-value"><asp:Label ID="lblEmergency" runat="server" /></span>
                            </div>
                        </div>
                        <div class="back-notes">
                            <p>The Employee ID card is replaceable if there is a change in employee's designation or department.</p>
                            <p><strong>Return:</strong> The Employee ID card is property of Bahria Town (Pvt) Ltd. and must be returned to HR Department upon the disengagement of services.</p>
                            <div class="authority-container">
                                <div class="authority-text">
                                    <strong>Issuing Authority:</strong><br />
                                    HR Department Bahria Town
                                </div>
                                 <div class="authority-sign">
                                            <asp:Image ID="Image1" runat="server" ImageUrl="~/images/signature.png" AlternateText="Signature" />
                                            <div class="sign-line"></div>
                                            <div class="sign-label"></div>
                                        </div>
                            </div>
                        </div>
                        <div class="back-footer">
                            <p><strong>If found please return to</strong></p>
                            <p>HR Department.</p>
                            <p>Nagori Stop Super Highway 9KM from Toll Plaza</p>
                            <p>0800-00100</p>
                            <p>www.bahriatown.com</p>
                        </div>
                    </div>
                </div>
            </div>
        </asp:Panel>

        <!-- ============================================ -->
        <!-- RFID MODAL (Unchanged)                        -->
        <!-- ============================================ -->
        <div id="rfidModal" class="modal-overlay no-print" style="display:none;">
            <div class="modal-box">
                <div class="modal-header">
                    <h3>📡 Scan RFID Card</h3>
                    <span class="modal-close" onclick="hideRFIDModal();">&times;</span>
                </div>
                <div class="modal-body">
                    <p class="modal-info">Tap/scan the RFID card on the reader below:</p>

                    <label class="modal-label">RFID Card Number</label>
                    <asp:TextBox ID="txtRFID" runat="server" CssClass="modal-input"
                        placeholder="Waiting for scan..." MaxLength="50"
                        autocomplete="off" />

                    <div id="rfidScanning" class="rfid-scanning" style="display:none;">
                        <div class="spinner"></div>
                        <span>Checking RFID...</span>
                    </div>

                    <div id="rfidError" class="modal-error" style="display:none;"></div>
                    <div id="rfidOk" class="modal-ok" style="display:none;"></div>

                    <div class="modal-meta">
                        <div><span>Employee:</span> <strong><asp:Label ID="lblModalEmp" runat="server" /></strong></div>
                        <div><span>Issue Date:</span> <strong><asp:Label ID="lblModalIssueDate" runat="server" /></strong></div>
                        <div><span>Expiry Date:</span> <strong><asp:Label ID="lblModalExpiryDate" runat="server" /></strong></div>
                        <div><span>Issued By:</span> <strong><asp:Label ID="lblModalIssuedBy" runat="server" /></strong></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-cancel" onclick="hideRFIDModal();">Cancel</button>
                    <asp:Button ID="btnConfirmRFID" runat="server" Text="✓ Validate RFID"
                        CssClass="btn-confirm" OnClick="btnConfirmRFID_Click"
                        UseSubmitBehavior="true" />
                </div>
            </div>
        </div>

        <!-- ============================================ -->
        <!-- CONFIRM PRINT MODAL (Unchanged)               -->
        <!-- ============================================ -->
        <div id="confirmPrintModal" class="modal-overlay no-print" style="display:none;">
            <div class="modal-box confirm-print-box">
                <div class="modal-header">
                    <h3>🖨 Confirm Print</h3>
                    <span class="modal-close" onclick="hideConfirmPrintModal();">&times;</span>
                </div>
                <div class="modal-body confirm-print-body">

                    <p class="modal-info">
                        Review the card before printing.<br />
                        <strong>Card:</strong> CR80 Portrait (54 × 85.6 mm) &nbsp;|&nbsp;
                        <strong>Printer:</strong> FARGO DTC1500 &nbsp;|&nbsp;
                        <strong>Mode:</strong> Duplex (Page 1 = Front, Page 2 = Back)
                    </p>

                    <div class="preview-wrapper">
                        <div class="card-container preview-scaled">

                            <div class="id-card front-card">
                                <div class="front-header">
                                    <div class="header-logo">
                                        <asp:Image ID="imgLogoPrev" runat="server" ImageUrl="~/RFID_Marketing_Form/Images/logo.png" AlternateText="Bahria" />
                                    </div>
                                    <div class="header-photo">
                                        <asp:Image ID="imgEmpPhotoPrev" runat="server" AlternateText="Employee Photo" />
                                    </div>
                                </div>
                                <div class="front-body">
                                    <div class="field-group">
                                        <span class="field-label">Employee ID:</span>
                                        <span class="field-value emp-id"><asp:Label ID="lblEmpIDPrev" runat="server" /></span>
                                    </div>
                                    <div class="field-group">
                                        <span class="field-label">Name :</span>
                                        <span class="field-value"><asp:Label ID="lblNamePrev" runat="server" /></span>
                                    </div>
                                    <div class="field-group">
                                        <span class="field-label">Designation:</span>
                                        <span class="field-value"><asp:Label ID="lblDesignationPrev" runat="server" /></span>
                                    </div>
                                    <div class="field-group">
                                        <span class="field-label">Department:</span>
                                        <span class="field-value"><asp:Label ID="lblDepartmentPrev" runat="server" /></span>
                                    </div>
                                    <div class="field-group">
                                        <span class="field-label">Project/Location:</span>
                                        <span class="field-value"><asp:Label ID="lblProjectPrev" runat="server" /></span>
                                    </div>
                                </div>
                                <div class="grade-badge">
                                    <asp:Label ID="lblGradeBadgePrev" runat="server" Text="EMPLOYEE" />
                                </div>
                            </div>

                            <div class="id-card back-card">
                                <div class="back-details">
                                    <div class="back-row">
                                        <span class="back-label">Joining Date:</span>
                                        <span class="back-value"><asp:Label ID="lblJoiningDatePrev" runat="server" /></span>
                                    </div>
                                    <div class="back-row">
                                        <span class="back-label">Issue Date:</span>
                                        <span class="back-value"><asp:Label ID="lblIssueDatePrev" runat="server" /></span>
                                    </div>
                                    <div class="back-row">
                                        <span class="back-label">Expiry Date:</span>
                                        <span class="back-value"><asp:Label ID="lblExpiryDatePrev" runat="server" /></span>
                                    </div>
                                    <div class="back-row">
                                        <span class="back-label">Blood Group:</span>
                                        <span class="back-value"><asp:Label ID="lblBloodGroupPrev" runat="server" /></span>
                                    </div>
                                    <div class="back-row">
                                        <span class="back-label">CNIC:</span>
                                        <span class="back-value"><asp:Label ID="lblCNICBackPrev" runat="server" /></span>
                                    </div>
                                    <div class="back-row">
                                        <span class="back-label">Emergency #:</span>
                                        <span class="back-value"><asp:Label ID="lblEmergencyPrev" runat="server" /></span>
                                    </div>
                                </div>
                                <div class="back-notes">
                                    <p>The Employee ID card is replaceable if there is a change in employee's designation or department.</p>
                                    <p><strong>Return:</strong> The Employee ID card is property of Bahria Town (Pvt) Ltd. and must be returned to HR Department upon the disengagement of services.</p>
                                    <div class="authority-container">
                                        <div class="authority-text">
                                            <strong>Issuing Authority:</strong><br />
                                            HR Department Bahria Town
                                        </div>
                                        <div class="authority-sign">
                                            <asp:Image ID="imgSignaturePrev" runat="server" ImageUrl="~/images/signature.png" AlternateText="Signature" />
                                            <div class="sign-line"></div>
                                            <div class="sign-label"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="back-footer">
                                    <p><strong>If found please return to</strong></p>
                                    <p>HR Department.</p>
                                    <p>Nagori Stop Super Highway 9KM from Toll Plaza</p>
                                    <p>0800-00100</p>
                                    <p>www.bahriatown.com</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-meta" style="margin-top:18px;">
                        <div><span>Employee:</span> <strong><asp:Label ID="lblConfirmEmp" runat="server" /></strong></div>
                        <div><span>RFID:</span> <strong><asp:Label ID="lblConfirmRfid" runat="server" /></strong></div>
                        <div><span>Issue Date:</span> <strong><asp:Label ID="lblConfirmIssue" runat="server" /></strong></div>
                        <div><span>Expiry Date:</span> <strong><asp:Label ID="lblConfirmExpiry" runat="server" /></strong></div>
                    </div>

                </div>
                <div class="modal-footer">
                    <div style="flex:1; text-align:left; font-size:11px; color:#6b7280; line-height:1.5;">
                        🖨 <strong>FARGO DTC1500</strong> · CR-80 Portrait (54 × 85.6 mm) · <strong>Duplex ON</strong><br />
                        Page 1 = Front (Golden) &nbsp;·&nbsp; Page 2 = Back (White)
                    </div>
                    <button type="button" class="btn-cancel" onclick="hideConfirmPrintModal();">Cancel</button>
                    <asp:Button ID="btnDoPrint" runat="server" Text="🖨 Confirm Print"
                        CssClass="btn-confirm" OnClick="btnDoPrint_Click" />
                </div>
            </div>
        </div>

        <!-- ============================================ -->
        <!-- VIEW DETAILS MODAL (read-only request fields) -->
        <!-- ============================================ -->
        <div id="viewDetailsModal" class="ec-modal-overlay no-print" aria-hidden="true">
            <div class="ec-modal" role="dialog" aria-labelledby="viewDetailsTitle">
                <div class="ec-modal__head">
                    <div>
                        <h3 id="viewDetailsTitle">Request details</h3>
                        <p class="ec-modal__sub"><asp:Label ID="lblDetModalSubtitle" runat="server" /></p>
                    </div>
                    <button type="button" class="ec-modal__close" onclick="hideViewDetailsModal();" aria-label="Close">&times;</button>
                </div>
                <div class="ec-modal__body">
                    <asp:Panel ID="pnlReadonlyDetails" runat="server">
                        <div class="ro-form ro-form--wide">
                            <div class="ro-field"><label>Request ID</label><asp:Label ID="lblDetReqId" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Employee ID</label><asp:Label ID="lblDetEmpId" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Name</label><asp:Label ID="lblDetName" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Designation</label><asp:Label ID="lblDetDesignation" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Department</label><asp:Label ID="lblDetDepartment" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Project / Location</label><asp:Label ID="lblDetProject" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Status</label><asp:Label ID="lblDetStatus" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>RFID number</label><asp:Label ID="lblDetRfid" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Forwarded by</label><asp:Label ID="lblDetForwardBy" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Forwarded on</label><asp:Label ID="lblDetForwardOn" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Printed on</label><asp:Label ID="lblDetPrintedOn" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Joining date</label><asp:Label ID="lblDetJoining" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>CNIC</label><asp:Label ID="lblDetCnic" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Blood group</label><asp:Label ID="lblDetBlood" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field"><label>Emergency #</label><asp:Label ID="lblDetEmergency" runat="server" CssClass="ro-value" /></div>
                            <div class="ro-field ro-field--full"><label>HOD remarks</label><asp:Label ID="lblDetHodRemarks" runat="server" CssClass="ro-value ro-value--remarks" /></div>
                            <div class="ro-field ro-field--full"><label>Requester remarks</label><asp:Label ID="lblDetRequesterRemarks" runat="server" CssClass="ro-value ro-value--remarks" /></div>
                        </div>
                    </asp:Panel>
                </div>
                <div class="ec-modal__foot">
                    <button type="button" class="btn-ec-secondary" onclick="hideViewDetailsModal();">Close</button>
                </div>
            </div>
        </div>

        <!-- ============================================ -->
        <!-- PRINT CARD VIEW (ID card + read-only fields)  -->
        <!-- ============================================ -->
        <div id="printCardViewModal" class="ec-modal-overlay no-print" aria-hidden="true">
            <div class="ec-modal" role="dialog" aria-labelledby="printCardViewTitle">
                <div class="ec-modal__head">
                    <div>
                        <h3 id="printCardViewTitle">Employee ID card preview</h3>
                        <p class="ec-modal__sub"><asp:Label ID="lblPcModalSubtitle" runat="server" /></p>
                    </div>
                    <button type="button" class="ec-modal__close" onclick="hidePrintCardViewModal();" aria-label="Close">&times;</button>
                </div>
                <div class="ec-modal__body">
                    <div class="ec-preview-split">
                        <div class="ec-cards-pane">
                            <p class="ec-cards-pane__title">Card preview (front &amp; back)</p>
                            <div id="printCardPreviewArea" class="card-container preview-scaled">
                                <div class="id-card front-card">
                                    <div class="front-header">
                                        <div class="header-logo">
                                            <asp:Image ID="imgPcLogo" runat="server" ImageUrl="~/RFID_Marketing_Form/Images/logo.png" AlternateText="Bahria" />
                                        </div>
                                        <div class="header-photo">
                                            <asp:Image ID="imgPcPhoto" runat="server" AlternateText="Employee Photo" />
                                        </div>
                                    </div>
                                    <div class="front-body">
                                        <div class="field-group">
                                            <span class="field-label">Employee ID:</span>
                                            <span class="field-value emp-id"><asp:Label ID="lblPcEmpId" runat="server" /></span>
                                        </div>
                                        <div class="field-group">
                                            <span class="field-label">Name :</span>
                                            <span class="field-value"><asp:Label ID="lblPcName" runat="server" /></span>
                                        </div>
                                        <div class="field-group">
                                            <span class="field-label">Designation:</span>
                                            <span class="field-value"><asp:Label ID="lblPcDesignation" runat="server" /></span>
                                        </div>
                                        <div class="field-group">
                                            <span class="field-label">Department:</span>
                                            <span class="field-value"><asp:Label ID="lblPcDepartment" runat="server" /></span>
                                        </div>
                                        <div class="field-group">
                                            <span class="field-label">Project/Location:</span>
                                            <span class="field-value"><asp:Label ID="lblPcProject" runat="server" /></span>
                                        </div>
                                    </div>
                                    <div class="grade-badge">
                                        <asp:Label ID="lblPcGradeBadge" runat="server" Text="EMPLOYEE" />
                                    </div>
                                </div>
                                <div class="id-card back-card">
                                    <div class="back-details">
                                        <div class="back-row">
                                            <span class="back-label">Joining Date:</span>
                                            <span class="back-value"><asp:Label ID="lblPcJoining" runat="server" /></span>
                                        </div>
                                        <div class="back-row">
                                            <span class="back-label">Issue Date:</span>
                                            <span class="back-value"><asp:Label ID="lblPcIssue" runat="server" /></span>
                                        </div>
                                        <div class="back-row">
                                            <span class="back-label">Expiry Date:</span>
                                            <span class="back-value"><asp:Label ID="lblPcExpiry" runat="server" /></span>
                                        </div>
                                        <div class="back-row">
                                            <span class="back-label">Blood Group:</span>
                                            <span class="back-value"><asp:Label ID="lblPcBlood" runat="server" /></span>
                                        </div>
                                        <div class="back-row">
                                            <span class="back-label">CNIC:</span>
                                            <span class="back-value"><asp:Label ID="lblPcCnic" runat="server" /></span>
                                        </div>
                                        <div class="back-row">
                                            <span class="back-label">Emergency #:</span>
                                            <span class="back-value"><asp:Label ID="lblPcEmergency" runat="server" /></span>
                                        </div>
                                    </div>
                                    <div class="back-notes">
                                        <p>The Employee ID card is replaceable if there is a change in employee's designation or department.</p>
                                        <p><strong>Return:</strong> The Employee ID card is property of Bahria Town (Pvt) Ltd. and must be returned to HR Department upon the disengagement of services.</p>
                                        <div class="authority-container">
                                            <div class="authority-text">
                                                <strong>Issuing Authority:</strong><br />
                                                HR Department Bahria Town
                                            </div>
                                            <div class="authority-sign">
                                                <asp:Image ID="imgPcSignature" runat="server" ImageUrl="~/images/signature.png" AlternateText="Signature" />
                                                <div class="sign-line"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="back-footer">
                                        <p><strong>If found please return to</strong></p>
                                        <p>HR Department.</p>
                                        <p>Nagori Stop Super Highway 9KM from Toll Plaza</p>
                                        <p>0800-00100</p>
                                        <p>www.bahriatown.com</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="ec-form-pane">
                            <p class="ec-form-pane__title">Assignment details</p>
                            <div class="ro-form ro-form--wide">
                                <div class="ro-field"><label>Request ID</label><asp:Label ID="lblPcDetReqId" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Employee ID</label><asp:Label ID="lblPcDetEmpId" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Name</label><asp:Label ID="lblPcDetName" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Designation</label><asp:Label ID="lblPcDetDesignation" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Department</label><asp:Label ID="lblPcDetDepartment" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Project / Location</label><asp:Label ID="lblPcDetProject" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Status</label><asp:Label ID="lblPcDetStatus" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>RFID number</label><asp:Label ID="lblPcDetRfid" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Forwarded by</label><asp:Label ID="lblPcDetForwardBy" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Forwarded on</label><asp:Label ID="lblPcDetForwardOn" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field"><label>Printed on</label><asp:Label ID="lblPcDetPrintedOn" runat="server" CssClass="ro-value" /></div>
                                <div class="ro-field ro-field--full"><label>HOD remarks</label><asp:Label ID="lblPcDetHodRemarks" runat="server" CssClass="ro-value ro-value--remarks" /></div>
                                <div class="ro-field ro-field--full"><label>Requester remarks</label><asp:Label ID="lblPcDetRequesterRemarks" runat="server" CssClass="ro-value ro-value--remarks" /></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="ec-modal__foot">
                    <button type="button" class="btn-ec-secondary" onclick="hidePrintCardViewModal();">Close</button>
                    <button type="button" class="btn-ec-primary" onclick="printCardPreviewOnly();">Print card</button>
                </div>
            </div>
        </div>

        <!-- ============================================ -->
        <!-- NEW: PHOTO UPLOAD MODAL                       -->
        <!-- ============================================ -->
        <div id="photoUploadModal" class="modal-overlay no-print" style="display:none;">
            <div class="modal-box">
                <div class="modal-header">
                    <h3>📷 Upload Dependent Photo</h3>
                    <span class="modal-close" onclick="hidePhotoUploadModal();">&times;</span>
                </div>
                <div class="modal-body">
                    <p class="modal-info">Upload a passport-size photo for the dependent. This will be used for the Family ID Card.</p>
                    
                    <label class="modal-label">Select Image (JPG/PNG)</label>
                    <asp:FileUpload ID="fuDependentPhoto" runat="server" CssClass="modal-input" accept=".jpg,.jpeg,.png" />

                    <div id="photoError" class="modal-error" style="display:none;"></div>
                    
                    <div class="modal-meta">
                        <div><span>Employee:</span> <strong><asp:Label ID="lblPhotoEmp" runat="server" /></strong></div>
                        <div><span>Dependent:</span> <strong><asp:Label ID="lblPhotoDep" runat="server" /></strong></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-cancel" onclick="hidePhotoUploadModal();">Cancel</button>
                    <asp:Button ID="btnSavePhoto" runat="server" Text="✓ Upload Photo" CssClass="btn-confirm" OnClick="btnSavePhoto_Click" />
                </div>
            </div>
        </div>

        <script type="text/javascript">
            function rfidEnterKey(e) {
                if (e.keyCode === 13 || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    var btn = document.getElementById('<%= btnConfirmRFID.ClientID %>');
                    if (btn) btn.click();
                    return false;
                }
                return true;
            }

            function showRFIDModal() {
                var modal = document.getElementById('rfidModal');
                if (modal) modal.style.display = 'flex';

                hideAll('rfidError');
                hideAll('rfidOk');
                hideAll('rfidScanning');

                var keep = document.getElementById('<%= hfKeepRfid.ClientID %>').value;
                var box = document.getElementById('<%= txtRFID.ClientID %>');

                if (box) {
                    if (keep !== '1') {
                        box.value = '';
                    }
                    box.focus();
                    box.onkeydown = rfidEnterKey;

                    if (box.setSelectionRange && box.value) {
                        try { box.setSelectionRange(box.value.length, box.value.length); } catch (e) { }
                    }
                }
            }

            function hideRFIDModal() {
                var modal = document.getElementById('rfidModal');
                if (modal) modal.style.display = 'none';
                hideAll('rfidError');
                hideAll('rfidOk');
                hideAll('rfidScanning');
            }

            function hideAll(id) {
                var el = document.getElementById(id);
                if (el) el.style.display = 'none';
            }

            function showRFIDError(msg) {
                hideAll('rfidScanning');
                hideAll('rfidOk');
                var err = document.getElementById('rfidError');
                if (err) {
                    err.innerText = msg;
                    err.style.display = 'block';
                }
            }

            function showRFIDOk(msg) {
                hideAll('rfidScanning');
                hideAll('rfidError');
                var ok = document.getElementById('rfidOk');
                if (ok) {
                    ok.innerText = msg;
                    ok.style.display = 'block';
                }
            }

            function showConfirmPrintModal() {
                var modal = document.getElementById('confirmPrintModal');
                if (modal) modal.style.display = 'flex';
            }

            function hideConfirmPrintModal() {
                var modal = document.getElementById('confirmPrintModal');
                if (modal) modal.style.display = 'none';
            }

            // NEW JS FUNCTIONS FOR PHOTO MODAL
            function showPhotoUploadModal() {
                document.getElementById('photoUploadModal').style.display = 'flex';
                document.getElementById('photoError').style.display = 'none';
            }
            function hidePhotoUploadModal() {
                document.getElementById('photoUploadModal').style.display = 'none';
            }

            function showViewDetailsModal() {
                var el = document.getElementById('viewDetailsModal');
                if (el) {
                    el.classList.add('is-open');
                    el.setAttribute('aria-hidden', 'false');
                }
            }

            function hideViewDetailsModal() {
                var el = document.getElementById('viewDetailsModal');
                if (el) {
                    el.classList.remove('is-open');
                    el.setAttribute('aria-hidden', 'true');
                }
            }

            function showPrintCardViewModal() {
                var el = document.getElementById('printCardViewModal');
                if (el) {
                    el.classList.add('is-open');
                    el.setAttribute('aria-hidden', 'false');
                }
            }

            function hidePrintCardViewModal() {
                var el = document.getElementById('printCardViewModal');
                if (el) {
                    el.classList.remove('is-open');
                    el.setAttribute('aria-hidden', 'true');
                }
            }

            function printCardPreviewOnly() {
                document.body.classList.add('print-card-preview');
                window.print();
                setTimeout(function () {
                    document.body.classList.remove('print-card-preview');
                }, 500);
            }
        </script>
    </form>
</body>
</html>