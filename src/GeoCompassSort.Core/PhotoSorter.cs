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
    /// Sorts every supported photo found under <paramref name="paths"/> and returns one
    /// result per file. Files are copied, not moved, so the originals are left intact.
    /// </summary>
    /// <param name="paths">
    /// A mix of individual file paths and/or folder paths — the shape a drag-and-drop
    /// operation or a multi-file picker naturally produces. Folders are expanded; a
    /// file that appears more than once (e.g. via an overlapping folder and a loose
    /// file already inside it) is only sorted once.
    /// </param>
    public IEnumerable<PhotoSortResult> SortPhotos(
        IEnumerable<string> paths,
        string outputFolder,
        GpsCoordinate assetCentre,
        bool includeSubfolders = false)
    {
        ArgumentNullException.ThrowIfNull(paths);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputFolder);

        foreach (var filePath in EnumerateImageFiles(paths, includeSubfolders))
        {
            yield return SortSinglePhoto(filePath, outputFolder, assetCentre);
        }
    }

    private IEnumerable<string> EnumerateImageFiles(IEnumerable<string> paths, bool includeSubfolders)
    {
        var searchOption = includeSubfolders ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var path in paths)
        {
            if (System.IO.Directory.Exists(path))
            {
                foreach (var filePath in System.IO.Directory.EnumerateFiles(path, "*", searchOption))
                {
                    if (_gpsReader.IsSupportedImage(filePath) && seen.Add(filePath))
                    {
                        yield return filePath;
                    }
                }
            }
            else if (File.Exists(path) && _gpsReader.IsSupportedImage(path) && seen.Add(path))
            {
                yield return path;
            }
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
