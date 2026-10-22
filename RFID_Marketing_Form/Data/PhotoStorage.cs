using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Web;

namespace RFID_Marketing_Form.Data
{
    public static class PhotoStorage
    {
        public const string PhotosFolder = "Photos";

        public static string NormalizeRelativePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return string.Empty;
            }

            path = HttpUtility.UrlDecode(path.Trim());
            path = path.Replace('\\', '/').TrimStart('/');
            return path;
        }

        public static bool IsSafeRelativePath(string path)
        {
            path = NormalizeRelativePath(path);
            if (path.Length == 0 || path.Length > 500)
            {
                return false;
            }

            if (path.IndexOf("..", StringComparison.Ordinal) >= 0)
            {
                return false;
            }

            for (int i = 0; i < path.Length; i++)
            {
                char c = path[i];
                if (!char.IsLetterOrDigit(c) && c != ' ' && c != '.' && c != '/' && c != ':' && c != '_' && c != '-' && c != '(' && c != ')')
                {
                    return false;
                }
            }

            return true;
        }

        public static string GetApplicationRoot(HttpContext context)
        {
            if (context == null || context.Request == null)
            {
                return null;
            }

            var root = context.Request.PhysicalApplicationPath;
            if (string.IsNullOrWhiteSpace(root))
            {
                try
                {
                    root = context.Server.MapPath("~/");
                }
                catch
                {
                    return null;
                }
            }

            return root.TrimEnd('\\', '/');
        }

        public static string GetPhotosPhysicalDirectory(HttpContext context)
        {
            var configuredRoot = ConfigurationManager.AppSettings["RfidPhotoRoot"];
            if (!string.IsNullOrWhiteSpace(configuredRoot))
            {
                var root = configuredRoot.Trim().TrimEnd('\\', '/');
                return Path.Combine(root, PhotosFolder);
            }

            var appRoot = GetApplicationRoot(context);
            if (string.IsNullOrEmpty(appRoot))
            {
                return null;
            }

            return Path.Combine(appRoot, PhotosFolder);
        }

        public static string ResolvePhysicalPath(HttpContext context, string relativePath)
        {
            relativePath = NormalizeRelativePath(relativePath);
            if (!IsSafeRelativePath(relativePath))
            {
                return null;
            }

            var candidates = new List<string>();
            var configuredRoot = ConfigurationManager.AppSettings["RfidPhotoRoot"];
            if (!string.IsNullOrWhiteSpace(configuredRoot))
            {
                var root = configuredRoot.Trim().TrimEnd('\\', '/');
                candidates.Add(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            }

            var appRoot = GetApplicationRoot(context);
            if (!string.IsNullOrEmpty(appRoot))
            {
                candidates.Add(Path.Combine(appRoot, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            }

            try
            {
                candidates.Add(context.Server.MapPath("~/" + relativePath));
            }
            catch
            {
            }

            var fileName = Path.GetFileName(relativePath.Replace('/', Path.DirectorySeparatorChar));
            if (!string.IsNullOrEmpty(fileName))
            {
                candidates.Add(Path.Combine(GetPhotosPhysicalDirectory(context), fileName));
            }

            for (int i = 0; i < candidates.Count; i++)
            {
                if (!string.IsNullOrEmpty(candidates[i]) && File.Exists(candidates[i]))
                {
                    return candidates[i];
                }
            }

            return null;
        }

        public static string BuildPublicUrl(HttpContext context, string relativePath)
        {
            relativePath = NormalizeRelativePath(relativePath);
            if (relativePath.Length == 0)
            {
                return string.Empty;
            }

            var parts = relativePath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < parts.Length; i++)
            {
                parts[i] = HttpUtility.UrlEncode(parts[i]);
            }

            var root = VirtualPathUtility.ToAbsolute("~/");
            if (!root.EndsWith("/", StringComparison.Ordinal))
            {
                root += "/";
            }

            return root + string.Join("/", parts);
        }

        public static string BuildHandlerUrl(HttpContext context, string relativePath)
        {
            relativePath = NormalizeRelativePath(relativePath);
            if (relativePath.Length == 0)
            {
                return string.Empty;
            }

            var root = VirtualPathUtility.ToAbsolute("~/");
            if (!root.EndsWith("/", StringComparison.Ordinal))
            {
                root += "/";
            }

            return root + "EmpPhoto.ashx?p=" + HttpUtility.UrlEncode(relativePath);
        }

        public static string SavePostedPhoto(HttpContext context, HttpPostedFile file)
        {
            if (context == null || file == null || file.ContentLength <= 0)
            {
                return null;
            }

            var fileName = Path.GetFileName(file.FileName);
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return null;
            }

            fileName = SanitizeFileName(fileName);
            if (fileName.Length == 0)
            {
                return null;
            }

            var photosDir = GetPhotosPhysicalDirectory(context);
            Directory.CreateDirectory(photosDir);
            var fullPath = Path.Combine(photosDir, fileName);
            file.SaveAs(fullPath);
            return PhotosFolder + "/" + fileName;
        }

        public static bool TrySavePostedPhoto(HttpContext context, out string relativePath)
        {
            return TrySavePostedPhoto(context, "employeePhoto", out relativePath);
        }

        public static bool TrySavePostedPhoto(HttpContext context, string fieldName, out string relativePath)
        {
            relativePath = null;
            if (context == null || context.Request == null || context.Request.Files == null)
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(fieldName))
            {
                fieldName = "employeePhoto";
            }

            HttpPostedFile upload = context.Request.Files[fieldName];
            if (upload == null || upload.ContentLength <= 0)
            {
                return false;
            }

            relativePath = SavePostedPhoto(context, upload);
            return !string.IsNullOrEmpty(relativePath);
        }

        private static string SanitizeFileName(string fileName)
        {
            fileName = Path.GetFileName(fileName);
            var chars = fileName.ToCharArray();
            for (int i = 0; i < chars.Length; i++)
            {
                char c = chars[i];
                if (!char.IsLetterOrDigit(c) && c != ' ' && c != '.' && c != '_' && c != '-' && c != '(' && c != ')')
                {
                    chars[i] = '_';
                }
            }

            return new string(chars).Trim();
        }

        public static string ContentTypeFor(string fullPath)
        {
            var ext = Path.GetExtension(fullPath);
            if (string.Equals(ext, ".png", StringComparison.OrdinalIgnoreCase)) return "image/png";
            if (string.Equals(ext, ".gif", StringComparison.OrdinalIgnoreCase)) return "image/gif";
            if (string.Equals(ext, ".webp", StringComparison.OrdinalIgnoreCase)) return "image/webp";
            if (string.Equals(ext, ".jpeg", StringComparison.OrdinalIgnoreCase)) return "image/jpeg";
            return "image/jpeg";
        }
    }
}
