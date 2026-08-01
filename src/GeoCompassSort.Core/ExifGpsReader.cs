using MetadataExtractor;
using MetadataExtractor.Formats.Exif;

namespace GeoCompassSort.Core;

/// <summary>Reads the embedded GPS position (camera location) from a photo's EXIF metadata.</summary>
public sealed class ExifGpsReader : IGpsReader
{
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".tif", ".tiff", ".heic", ".heif", ".png", ".webp",
    };

    public bool IsSupportedImage(string filePath) =>
        SupportedExtensions.Contains(Path.GetExtension(filePath));

    /// <summary>
    /// Attempts to read the GPS coordinate the camera recorded when the photo was taken.
    /// Returns false if the file has no readable GPS EXIF tag (e.g. GPS was off, or the
    /// tag was stripped) or the file isn't a supported/valid image.
    /// </summary>
    public bool TryReadGpsCoordinate(string filePath, out GpsCoordinate coordinate)
    {
        coordinate = default;

        IReadOnlyList<MetadataExtractor.Directory> directories;
        try
        {
            directories = ImageMetadataReader.ReadMetadata(filePath);
        }
        catch (Exception ex) when (ex is ImageProcessingException or IOException)
        {
            return false;
        }

        var gpsDirectory = directories.OfType<GpsDirectory>().FirstOrDefault();
        var location = gpsDirectory?.GetGeoLocation();

        if (location is null || location.IsZero)
        {
            return false;
        }

        var candidate = GpsCoordinate.TryCreate(location.Latitude, location.Longitude);
        if (candidate is null)
        {
            return false;
        }

        coordinate = candidate.Value;
        return true;
    }
}
