using System;
using System.Collections.Generic;

namespace RFID_Marketing_Form.Data
{
    public class FieldIssue
    {
        public string Key { get; set; }
        public string Message { get; set; }
    }

    public class RfidInput
    {
        public string IdText { get; set; }
        public string EmpId { get; set; }
        public string RfidNumber { get; set; }
        public string Status { get; set; }
        public string IssueDateText { get; set; }
        public string ExpiryDateText { get; set; }
        public string IssuedBy { get; set; }
        public string PrintDateText { get; set; }
        public string CreatedDateText { get; set; }
        public string IsApproved { get; set; }
        public string ApprovedDateText { get; set; }
        public string ApproveIdText { get; set; }
        public string HodRemarks { get; set; }
        public string IsForwardHod { get; set; }
        public string ForwardBy { get; set; }
        public string ForwardOnText { get; set; }
        public string RequesterRemarks { get; set; }
        public string CardName { get; set; }
        public string Designation { get; set; }
        public string Department { get; set; }
        public string ProjectLocation { get; set; }
        public string JoiningDateText { get; set; }
        public string BloodGroup { get; set; }
        public string Cnic { get; set; }
        public string EmergencyNo { get; set; }
        public string PhotoPathText { get; set; }
        public string PhotoPath { get; set; }

        public decimal? Id { get; set; }
        public DateTime? JoiningDate { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public DateTime? PrintDate { get; set; }
        public DateTime? CreatedDate { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public decimal? ApproveId { get; set; }
        public DateTime? ForwardOn { get; set; }
    }

    public class DuplicateInfo
    {
        public bool HasEmpOpen { get; set; }
        public string EmpStatus { get; set; }
        public bool HasRfid { get; set; }
        public bool HasId { get; set; }
        public string Error { get; set; }

        public bool Blocked
        {
            get { return HasEmpOpen || HasRfid || HasId; }
        }
    }

    public class ConnectionStatus
    {
        public string Level { get; set; }
        public string Message { get; set; }
        public string TableName { get; set; }
    }

    public class RfidRecord
    {
        public decimal Id { get; set; }
        public string EmpId { get; set; }
        public string EmployeeName { get; set; }
        public string Relationship { get; set; }
        public string CardId { get; set; }
        public string Designation { get; set; }
        public string Department { get; set; }
        public string ProjectLocation { get; set; }
        public string JoiningDate { get; set; }
        public string BloodGroup { get; set; }
        public string Cnic { get; set; }
        public string EmergencyNo { get; set; }
        public string RfidNumber { get; set; }
        public string Etag { get; set; }
        public string Status { get; set; }
        public string StatusRemarks { get; set; }
        public string IssueDate { get; set; }
        public string ExpiryDate { get; set; }
        public string IssuedBy { get; set; }
        public string PrintDate { get; set; }
        public string CreatedDate { get; set; }
        public string IsApproved { get; set; }
        public string ApprovedDate { get; set; }
        public string ApproveId { get; set; }
        public string HodRemarks { get; set; }
        public string IsForwardHod { get; set; }
        public string ForwardBy { get; set; }
        public string ForwardOn { get; set; }
        public string RequesterRemarks { get; set; }
        public string PhotoPath { get; set; }
        /// <summary>GRD_AB from V_EMPS (employee grade abbreviation).</summary>
        public string Grade { get; set; }
        /// <summary>Card footer strip: OFFICIAL if grade &gt; 5, else EMPLOYEE.</summary>
        public string CardBadge { get; set; }
    }

    public class FamilyCardRecord
    {
        public decimal Id { get; set; }
        public string EmpId { get; set; }
        public decimal DependentId { get; set; }
        public string CardId { get; set; }
        public string CardName { get; set; }
        public string Relationship { get; set; }
        public string Cnic { get; set; }
        public string RfidNumber { get; set; }
        public string Etag { get; set; }
        public string IssueDate { get; set; }
        public string ExpiryDate { get; set; }
        public string PhotoPath { get; set; }
        public string Status { get; set; }
        public string IssuedBy { get; set; }
        public string PrintDate { get; set; }
        public string CreatedDate { get; set; }
        public string StatusRemarks { get; set; }
        public string IsApproved { get; set; }
    }

    public class CardVoucherRecord
    {
        public decimal VoucherId { get; set; }
        public decimal AssignmentId { get; set; }
        public string RecordScope { get; set; }
        public string VoucherNo { get; set; }
        public string VoucherType { get; set; }
        public string RefNo { get; set; }
        public string EmployeeName { get; set; }
        public string Cnic { get; set; }
        public string CategoryName { get; set; }
        public decimal Amount { get; set; }
        public string AmountWords { get; set; }
        public int CardCount { get; set; }
        public string Status { get; set; }
        public string GeneratedBy { get; set; }
        public string GeneratedOn { get; set; }
        public string PaidBy { get; set; }
        public string PaidOn { get; set; }
        public string Remarks { get; set; }
    }

    public class RfidRecordsResult
    {
        public bool Ok { get; set; }
        public string Error { get; set; }
        public string TableName { get; set; }
        public List<RfidRecord> Records { get; set; }
        public RfidRecord Record { get; set; }
        public List<FamilyCardRecord> FamilyCards { get; set; }
        public CardVoucherRecord Voucher { get; set; }
        public List<CardVoucherRecord> Vouchers { get; set; }
        public string Status { get; set; }
        public string StatusRemarks { get; set; }

        public static RfidRecordsResult Fail(string message)
        {
            return new RfidRecordsResult { Ok = false, Error = message ?? string.Empty, Records = new List<RfidRecord>() };
        }
    }

    public class FamilyCardInput
    {
        public decimal? Id { get; set; }
        public string EmpId { get; set; }
        public decimal DependentId { get; set; }
        public string CardId { get; set; }
        public string CardName { get; set; }
        public string Relationship { get; set; }
        public string Cnic { get; set; }
        public string RfidNumber { get; set; }
        public string Status { get; set; }
        public string IssueDateText { get; set; }
        public string ExpiryDateText { get; set; }
        public string IssuedBy { get; set; }
        public string PrintDateText { get; set; }
        public string IsApproved { get; set; }
        public string ApprovedDateText { get; set; }
        public string ApproveIdText { get; set; }
        public string HodRemarks { get; set; }
        public string IsForwardHod { get; set; }
        public string ForwardBy { get; set; }
        public string ForwardOnText { get; set; }
        public string RequesterRemarks { get; set; }
        public string PhotoPath { get; set; }

        public DateTime? IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public DateTime? PrintDate { get; set; }
        public DateTime? CreatedDate { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public DateTime? ForwardOn { get; set; }
        public decimal? ApproveId { get; set; }
    }

    public class SaveResult
    {
        public bool Success { get; set; }
        public string Kind { get; set; }
        public string Title { get; set; }
        public List<string> Messages { get; set; }
        public List<string> Fields { get; set; }
        public decimal? NewId { get; set; }
        public string TableName { get; set; }

        public static SaveResult FromIssues(string kind, string title, IList<FieldIssue> issues)
        {
            var messages = new List<string>();
            var fields = new List<string>();
            if (issues != null)
            {
                for (int i = 0; i < issues.Count; i++)
                {
                    messages.Add(issues[i].Message);
                    if (!string.IsNullOrEmpty(issues[i].Key) && !fields.Contains(issues[i].Key))
                    {
                        fields.Add(issues[i].Key);
                    }
                }
            }

            return new SaveResult
            {
                Success = false,
                Kind = kind,
                Title = title,
                Messages = messages,
                Fields = fields
            };
        }
    }
}
