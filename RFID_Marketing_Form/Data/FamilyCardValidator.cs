using System;
using System.Collections.Generic;
using System.Globalization;

namespace RFID_Marketing_Form.Data
{
    public static class FamilyCardValidator
    {
        private static readonly string[] DateFormats =
        {
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "dd-MMM-yyyy"
        };

        public static List<FieldIssue> Validate(FamilyCardInput input)
        {
            var issues = new List<FieldIssue>();
            if (input == null)
            {
                issues.Add(Issue("emp", "The form was empty."));
                return issues;
            }

            input.EmpId = Clean(input.EmpId);
            input.CardName = Clean(input.CardName);
            input.Relationship = Clean(input.Relationship);
            input.Cnic = Clean(input.Cnic);
            input.RfidNumber = Clean(input.RfidNumber);
            input.Status = Clean(input.Status);
            input.HodRemarks = Clean(input.HodRemarks);
            input.ForwardBy = Clean(input.ForwardBy);
            input.RequesterRemarks = Clean(input.RequesterRemarks);
            input.PhotoPath = Clean(input.PhotoPath);
            input.IsApproved = Clean(input.IsApproved).ToUpperInvariant();
            input.IsForwardHod = Clean(input.IsForwardHod).ToUpperInvariant();
            if (input.IsApproved != "Y" && input.IsApproved != "N")
            {
                input.IsApproved = "N";
            }

            input.ApproveId = TryParseApproveId(input.ApproveIdText);
            input.IssueDate = ParseRequiredDate(input.IssueDateText, "issue", "Issue date", issues);
            input.ExpiryDate = null;
            input.ApprovedDate = ParseOptionalDate(input.ApprovedDateText, "approvedDate", "Approved date", issues);
            input.ForwardOn = ParseOptionalDate(input.ForwardOnText, "forwardOn", "Forwarded on", issues);
            input.CreatedDate = DateTime.Now;

            if (input.EmpId.Length == 0)
            {
                issues.Add(Issue("emp", "Employee ID is required."));
            }
            else if (input.EmpId.Length > 20 || !System.Text.RegularExpressions.Regex.IsMatch(input.EmpId, @"^[A-Za-z0-9][A-Za-z0-9\-\/_.]*$"))
            {
                issues.Add(Issue("emp", "Employee ID must be 1 to 20 characters: letters, numbers, hyphen, slash, underscore, or dot."));
            }

            if (input.CardName.Length == 0)
            {
                issues.Add(Issue("familyName", "Family member name is required."));
            }
            else if (input.CardName.Length > 100 || !RfidValidator.IsPersonName(input.CardName))
            {
                issues.Add(Issue("familyName", "Family member name must be 1 to 100 characters."));
            }

            if (input.Relationship.Length == 0)
            {
                issues.Add(Issue("familyRelationship", "Relationship is required."));
            }
            else if (input.Relationship.Length > 50)
            {
                issues.Add(Issue("familyRelationship", "Relationship cannot exceed 50 characters."));
            }

            if (input.Cnic.Length > 20)
            {
                issues.Add(Issue("familyCnic", "CNIC cannot exceed 20 characters."));
            }

            if (input.Status.Length == 0)
            {
                input.Status = "Active";
            }
            else if (!input.Status.Equals("Active", StringComparison.OrdinalIgnoreCase)
                && !input.Status.Equals("Inactive", StringComparison.OrdinalIgnoreCase))
            {
                issues.Add(Issue("status", "Status must be Active or Inactive."));
            }
            else
            {
                input.Status = CanonicalStatus(input.Status);
            }

            if (input.IssueDate.HasValue)
            {
                input.ExpiryDate = input.IssueDate.Value.AddYears(1);
            }

            if (input.IsForwardHod == "Y")
            {
                if (input.ForwardBy.Length == 0)
                {
                    issues.Add(Issue("forwardBy", "Forwarded by is required when the request goes to the HOD."));
                }

                if (!input.ForwardOn.HasValue)
                {
                    issues.Add(Issue("forwardOn", "Forwarded on is required when the request goes to the HOD."));
                }
            }

            if (input.IsApproved == "Y" && !input.ApprovedDate.HasValue)
            {
                issues.Add(Issue("approvedDate", "Approved date is required when the request is approved."));
            }

            if (input.RfidNumber.Length > 50)
            {
                issues.Add(Issue("rfid", "RFID number cannot exceed 50 characters."));
            }

            if (input.PhotoPath.Length > 500)
            {
                issues.Add(Issue("photo", "Photo path cannot exceed 500 characters."));
            }

            return issues;
        }

        private static string CanonicalStatus(string status)
        {
            return status.Equals("Inactive", StringComparison.OrdinalIgnoreCase) ? "Inactive" : "Active";
        }

        private static DateTime? ParseRequiredDate(string text, string key, string label, List<FieldIssue> issues)
        {
            if (Clean(text).Length == 0)
            {
                issues.Add(Issue(key, label + " is required."));
                return null;
            }

            return ParseOptionalDate(text, key, label, issues);
        }

        private static DateTime? ParseOptionalDate(string text, string key, string label, List<FieldIssue> issues)
        {
            text = Clean(text);
            if (text.Length == 0)
            {
                return null;
            }

            DateTime value;
            if (DateTime.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out value))
            {
                return value.Date;
            }

            if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out value))
            {
                return value.Date;
            }

            issues.Add(Issue(key, label + " is not a valid date."));
            return null;
        }

        private static string Clean(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        }

        private static FieldIssue Issue(string key, string message)
        {
            return new FieldIssue { Key = key, Message = message };
        }

        private static decimal? TryParseApproveId(string text)
        {
            text = Clean(text);
            if (text.Length == 0)
            {
                return null;
            }

            decimal id;
            return decimal.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out id) ? (decimal?)id : null;
        }
    }
}
