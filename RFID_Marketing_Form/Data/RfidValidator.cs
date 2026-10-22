using System;
using System.Collections.Generic;
using System.Globalization;

namespace RFID_Marketing_Form.Data
{
    public static class RfidValidator
    {
        private static readonly string[] DateFormats = new[]
        {
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "dd-MMM-yyyy"
        };

        private static readonly HashSet<string> Statuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Active",
            "Inactive"
        };

        public static List<FieldIssue> Validate(RfidInput input)
        {
            var issues = new List<FieldIssue>();
            if (input == null)
            {
                issues.Add(Issue("emp", "The form was empty."));
                return issues;
            }

            input.EmpId = Clean(input.EmpId);
            input.RfidNumber = Clean(input.RfidNumber);
            input.Status = Clean(input.Status);
            input.IssuedBy = Clean(input.IssuedBy);
            input.HodRemarks = Clean(input.HodRemarks);
            input.ForwardBy = Clean(input.ForwardBy);
            input.RequesterRemarks = Clean(input.RequesterRemarks);
            input.CardName = Clean(input.CardName);
            input.Designation = Clean(input.Designation);
            input.Department = Clean(input.Department);
            input.ProjectLocation = Clean(input.ProjectLocation);
            input.JoiningDateText = Clean(input.JoiningDateText);
            input.BloodGroup = Clean(input.BloodGroup);
            input.Cnic = Clean(input.Cnic);
            input.EmergencyNo = Clean(input.EmergencyNo);
            input.PhotoPathText = Clean(input.PhotoPathText);
            input.PhotoPath = input.PhotoPathText;
            input.IsApproved = Clean(input.IsApproved).ToUpperInvariant();
            input.IsForwardHod = Clean(input.IsForwardHod).ToUpperInvariant();

            input.Id = null;
            input.ApproveId = TryParseId(input.ApproveIdText);
            input.IssueDate = ParseDate(input.IssueDateText, "issue", "Issue date", issues);
            input.ExpiryDate = null;
            input.PrintDate = ParseOptionalDate(input.PrintDateText, "print", "Print date", issues);
            if (Clean(input.CreatedDateText).Length == 0)
            {
                input.CreatedDate = DateTime.Now;
            }
            else
            {
                input.CreatedDate = ParseDate(input.CreatedDateText, "created", "Created date", issues);
            }
            input.ApprovedDate = ParseDate(input.ApprovedDateText, "approvedDate", "Approved date", issues);
            input.ForwardOn = ParseDate(input.ForwardOnText, "forwardOn", "Forwarded on", issues);
            input.JoiningDate = ParseOptionalDate(input.JoiningDateText, "joining", "Joining date", issues);

            if (input.EmpId.Length == 0)
            {
                issues.Add(Issue("emp", "Employee ID is required."));
            }
            else if (input.EmpId.Length > 20 || !IsEmpId(input.EmpId))
            {
                issues.Add(Issue("emp", "Employee ID must be 1 to 20 characters: letters, numbers, hyphen, slash, underscore, or dot."));
            }

            if (input.PhotoPath.Length > 500)
            {
                issues.Add(Issue("photo", "Photo path cannot be longer than 500 characters."));
            }
            else if (input.PhotoPath.Length > 0 && !IsPhotoPath(input.PhotoPath))
            {
                issues.Add(Issue("photo", "Photo path may only use letters, numbers, spaces, and . \\ / : _ -"));
            }

            LimitOptionalText(issues, "cardName", "Name", input.CardName, 100);
            LimitOptionalText(issues, "designation", "Designation", input.Designation, 100);
            LimitOptionalText(issues, "department", "Department", input.Department, 100);
            LimitOptionalText(issues, "project", "Project / Location", input.ProjectLocation, 100);
            LimitOptionalText(issues, "bloodGroup", "Blood group", input.BloodGroup, 20);
            LimitOptionalText(issues, "cnic", "CNIC", input.Cnic, 20);
            LimitOptionalText(issues, "emergencyNo", "Emergency #", input.EmergencyNo, 30);

            if (input.RfidNumber.Length > 0 &&
                (input.RfidNumber.Length < 4 || input.RfidNumber.Length > 50 || !IsRfid(input.RfidNumber)))
            {
                issues.Add(Issue("rfid", "RFID number must be 4 to 50 characters: letters, numbers, spaces, hyphens, or colons."));
            }

            if (input.Status.Length == 0)
            {
                issues.Add(Issue("status", "Status is required."));
            }
            else if (!Statuses.Contains(input.Status))
            {
                issues.Add(Issue("status", "Choose a status from the list."));
            }
            else
            {
                input.Status = CanonicalStatus(input.Status);
            }

            if (input.IssuedBy.Length > 0 && (input.IssuedBy.Length > 50 || !IsPersonName(input.IssuedBy)))
            {
                issues.Add(Issue("issuedBy", "Issued by must be 1 to 50 characters: letters, numbers, spaces, and . ' -"));
            }

            if (!input.IssueDate.HasValue && Clean(input.IssueDateText).Length == 0)
            {
                issues.Add(Issue("issue", "Issue date is required."));
            }

            var today = DateTime.Today;
            if (input.CreatedDate.HasValue)
            {
                BoundDate(issues, "created", "Created date", input.CreatedDate.Value, new DateTime(2000, 1, 1), today);
            }

            if (input.IssueDate.HasValue)
            {
                BoundDate(issues, "issue", "Issue date", input.IssueDate.Value, new DateTime(2000, 1, 1), today.AddDays(30));
                input.ExpiryDate = input.IssueDate.Value.AddYears(1);
            }

            if (input.PrintDate.HasValue && input.IssueDate.HasValue && input.PrintDate.Value.Date < input.IssueDate.Value.Date)
            {
                issues.Add(Issue("print", "Print date cannot be before the issue date."));
            }

            if (input.IsForwardHod != "Y" && input.IsForwardHod != "N" && input.IsForwardHod.Length > 0)
            {
                issues.Add(Issue("forward", "Forward to HOD must be Yes or No."));
            }

            if (input.IsForwardHod == "Y")
            {
                if (input.ForwardBy.Length == 0)
                {
                    issues.Add(Issue("forwardBy", "Forwarded by is required when the request goes to the HOD."));
                }
                else if (input.ForwardBy.Length > 100 || !IsPersonName(input.ForwardBy))
                {
                    issues.Add(Issue("forwardBy", "Forwarded by must be 1 to 100 characters: letters, numbers, spaces, and . ' -"));
                }

                if (!input.ForwardOn.HasValue && Clean(input.ForwardOnText).Length == 0)
                {
                    issues.Add(Issue("forwardOn", "Forwarded on is required when the request goes to the HOD."));
                }
            }
            else
            {
                if (input.ForwardBy.Length > 0)
                {
                    issues.Add(Issue("forwardBy", "Clear Forwarded by, or set Forward to HOD to Yes."));
                }

                if (input.ForwardOn.HasValue || Clean(input.ForwardOnText).Length > 0)
                {
                    issues.Add(Issue("forwardOn", "Clear Forwarded on, or set Forward to HOD to Yes."));
                }
            }

            if (input.ForwardOn.HasValue && input.CreatedDate.HasValue && input.ForwardOn.Value.Date < input.CreatedDate.Value.Date)
            {
                issues.Add(Issue("forwardOn", "Forwarded on cannot be before the created date."));
            }

            if (input.IsApproved == "Y")
            {
                if (!input.ApprovedDate.HasValue && Clean(input.ApprovedDateText).Length == 0)
                {
                    issues.Add(Issue("approvedDate", "Approved date is required when the request is approved."));
                }
            }
            else
            {
                if (input.ApprovedDate.HasValue || Clean(input.ApprovedDateText).Length > 0)
                {
                    issues.Add(Issue("approvedDate", "Clear the approved date, or set Approved to Yes."));
                }
            }

            if (input.ApprovedDate.HasValue && input.CreatedDate.HasValue && input.ApprovedDate.Value.Date < input.CreatedDate.Value.Date)
            {
                issues.Add(Issue("approvedDate", "Approved date cannot be before the created date."));
            }

            if (input.IsApproved.Length == 0)
            {
                input.IsApproved = "N";
            }
            else if (input.IsApproved != "Y" && input.IsApproved != "N")
            {
                issues.Add(Issue("approved", "Approved must be Yes or No."));
            }

            return issues;
        }

        public static void AddDuplicateIssues(DuplicateInfo info, IList<FieldIssue> issues)
        {
            if (info == null || issues == null)
            {
                return;
            }

            if (info.HasEmpOpen)
            {
                issues.Add(Issue("emp", "This employee ID is already on file. Each employee can only have one RFID record."));
            }

            if (info.HasRfid)
            {
                issues.Add(Issue("rfid", "This RFID number is already on file. Use a different card number."));
            }
        }

        private static decimal? TryParseId(string text)
        {
            text = Clean(text);
            if (text.Length == 0)
            {
                return null;
            }

            decimal value;
            if (!decimal.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out value) || value <= 0 || value > 9999999999m || text.Length > 10)
            {
                return null;
            }

            return value;
        }

        private static DateTime? ParseOptionalDate(string text, string key, string label, IList<FieldIssue> issues)
        {
            text = Clean(text);
            if (text.Length == 0)
            {
                return null;
            }

            return ParseDate(text, key, label, issues);
        }

        private static DateTime? ParseDate(string text, string key, string label, IList<FieldIssue> issues)
        {
            text = Clean(text);
            if (text.Length == 0)
            {
                return null;
            }

            DateTime value;
            if (!DateTime.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out value))
            {
                issues.Add(Issue(key, label + " is not a valid date."));
                return null;
            }

            return value.Date;
        }

        private static void BoundDate(IList<FieldIssue> issues, string key, string label, DateTime value, DateTime min, DateTime max)
        {
            if (value.Date < min || value.Date > max)
            {
                issues.Add(Issue(key, label + " must be between " + min.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) + " and " + max.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) + "."));
            }
        }

        private static bool IsEmpId(string value)
        {
            if (value.Length == 0 || !char.IsLetterOrDigit(value[0]))
            {
                return false;
            }

            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                if (!char.IsLetterOrDigit(c) && c != '-' && c != '/' && c != '_' && c != '.')
                {
                    return false;
                }
            }

            return true;
        }

        private static bool IsPhotoPath(string value)
        {
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                if (!char.IsLetterOrDigit(c) && c != ' ' && c != '.' && c != '\\' && c != '/' && c != ':' && c != '_' && c != '-')
                {
                    return false;
                }
            }

            return true;
        }

        public static bool IsRfid(string value)
        {
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                if (!char.IsLetterOrDigit(c) && c != '-' && c != ':' && c != ' ')
                {
                    return false;
                }
            }

            return true;
        }

        public static bool IsPersonName(string value)
        {
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                if (!char.IsLetterOrDigit(c) && c != ' ' && c != '.' && c != '\'' && c != '-' && c != ',')
                {
                    return false;
                }
            }

            return true;
        }

        private static string CanonicalStatus(string status)
        {
            if (status.Equals("Active", StringComparison.OrdinalIgnoreCase)) return "Active";
            if (status.Equals("Inactive", StringComparison.OrdinalIgnoreCase)) return "Inactive";
            return status;
        }

        private static bool Is(string status, string expected)
        {
            return string.Equals(status, expected, StringComparison.OrdinalIgnoreCase);
        }

        private static string Clean(string value)
        {
            return value == null ? string.Empty : value.Trim();
        }

        private static void LimitOptionalText(IList<FieldIssue> issues, string key, string label, string value, int max)
        {
            if (value != null && value.Length > max)
            {
                issues.Add(Issue(key, label + " cannot be longer than " + max.ToString(CultureInfo.InvariantCulture) + " characters."));
            }
        }

        private static FieldIssue Issue(string key, string message)
        {
            return new FieldIssue { Key = key, Message = message };
        }
    }
}
