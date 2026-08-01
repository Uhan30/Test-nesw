namespace GeoCompassSort.Core;

/// <summary>
/// Scans a folder of geotagged photos and copies each one into a compass-sector
/// subfolder (North, North-East, East, South-East, South, South-West, West,
/// North-West) of an output folder, based on the bearing from a fixed asset
/// centre point to the position the camera recorded when the photo was taken.
/// </summary>
public sealed class PhotoSorter
{
    private readonly IGpsReader _gpsReader;

    public PhotoSorter(IGpsReader? gpsReader = null)
    {
        _gpsReader = gpsReader ?? new ExifGpsReader();
    }

    /// <summary>
    /// Sorts every supported photo in <paramref name="sourceFolder"/> and returns one
    /// result per file. Files are copied, not moved, so the source folder is left intact.
    /// </summary>
    public IEnumerable<PhotoSortResult> SortPhotos(
        string sourceFolder,
        string outputFolder,
        GpsCoordinate assetCentre,
        bool includeSubfolders = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sourceFolder);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputFolder);

        var searchOption = includeSubfolders ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;

        foreach (var filePath in System.IO.Directory.EnumerateFiles(sourceFolder, "*", searchOption))
        {
            if (!_gpsReader.IsSupportedImage(filePath))
            {
                continue;
            }

            yield return SortSinglePhoto(filePath, outputFolder, assetCentre);
        }
    }

    private PhotoSortResult SortSinglePhoto(string filePath, string outputFolder, GpsCoordinate assetCentre)
    {
        try
        {
            if (!_gpsReader.TryReadGpsCoordinate(filePath, out var cameraPosition))
            {
                return new PhotoSortResult(filePath, PhotoSortStatus.NoGpsData);
            }

            double bearing = BearingCalculator.CalculateInitialBearing(assetCentre, cameraPosition);
            CompassSector sector = bearing.ToCompassSector();

            string sectorFolder = Path.Combine(outputFolder, sector.ToFolderName());
            System.IO.Directory.CreateDirectory(sectorFolder);

            string destinationPath = GetAvailableDestinationPath(sectorFolder, Path.GetFileName(filePath));
            File.Copy(filePath, destinationPath, overwrite: false);

            return new PhotoSortResult(filePath, PhotoSortStatus.Sorted, cameraPosition, bearing, sector, destinationPath);
        }
        catch (Exception ex)
        {
            return new PhotoSortResult(filePath, PhotoSortStatus.Error, ErrorMessage: ex.Message);
        }
    }

    /// <summary>Appends " (1)", " (2)", etc. to avoid overwriting a file already sorted into this sector.</summary>
    private static string GetAvailableDestinationPath(string folder, string fileName)
    {
        string candidate = Path.Combine(folder, fileName);
        if (!File.Exists(candidate))
        {
            return candidate;
        }

        string nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
        string extension = Path.GetExtension(fileName);

        for (int suffix = 1; ; suffix++)
        {
            candidate = Path.Combine(folder, $"{nameWithoutExtension} ({suffix}){extension}");
            if (!File.Exists(candidate))
            {
                return candidate;
            }
        }
    }
}
