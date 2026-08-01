using GeoCompassSort.Core;

namespace GeoCompassSort.Core.Tests;

/// <summary>A fake GPS reader so PhotoSorter's file-handling logic can be tested
/// without needing real JPEG bytes with embedded EXIF GPS tags.</summary>
file sealed class FakeGpsReader : IGpsReader
{
    private readonly Dictionary<string, GpsCoordinate> _coordinatesByFileName;

    public FakeGpsReader(Dictionary<string, GpsCoordinate> coordinatesByFileName)
    {
        _coordinatesByFileName = coordinatesByFileName;
    }

    public bool IsSupportedImage(string filePath) =>
        Path.GetExtension(filePath).Equals(".jpg", StringComparison.OrdinalIgnoreCase);

    public bool TryReadGpsCoordinate(string filePath, out GpsCoordinate coordinate)
    {
        return _coordinatesByFileName.TryGetValue(Path.GetFileName(filePath), out coordinate);
    }
}

public class PhotoSorterTests : IDisposable
{
    private readonly string _sourceFolder;
    private readonly string _outputFolder;
    private static readonly GpsCoordinate AssetCentre = new(0, 0);

    public PhotoSorterTests()
    {
        _sourceFolder = Directory.CreateTempSubdirectory("gcs-source-").FullName;
        _outputFolder = Directory.CreateTempSubdirectory("gcs-output-").FullName;
    }

    public void Dispose()
    {
        Directory.Delete(_sourceFolder, recursive: true);
        Directory.Delete(_outputFolder, recursive: true);
    }

    private string CreatePhoto(string fileName) => CreatePhoto(fileName, _sourceFolder);

    private static string CreatePhoto(string fileName, string folder)
    {
        string path = Path.Combine(folder, fileName);
        File.WriteAllBytes(path, new byte[] { 0xFF, 0xD8, 0xFF }); // fake JPEG marker, content unused by fake reader
        return path;
    }

    [Fact]
    public void CopiesEachPhotoIntoItsSectorFolder()
    {
        CreatePhoto("north.jpg");
        CreatePhoto("east.jpg");

        var reader = new FakeGpsReader(new Dictionary<string, GpsCoordinate>
        {
            ["north.jpg"] = new GpsCoordinate(10, 0),  // bearing 0 -> North
            ["east.jpg"] = new GpsCoordinate(0, 10),   // bearing 90 -> East
        });

        var sorter = new PhotoSorter(reader);
        var results = sorter.SortPhotos(new[] { _sourceFolder }, _outputFolder, AssetCentre).ToList();

        Assert.Equal(2, results.Count);
        Assert.All(results, r => Assert.Equal(PhotoSortStatus.Sorted, r.Status));

        Assert.True(File.Exists(Path.Combine(_outputFolder, "North", "north.jpg")));
        Assert.True(File.Exists(Path.Combine(_outputFolder, "East", "east.jpg")));

        // Source files are untouched (copy, not move).
        Assert.True(File.Exists(Path.Combine(_sourceFolder, "north.jpg")));
        Assert.True(File.Exists(Path.Combine(_sourceFolder, "east.jpg")));
    }

    [Fact]
    public void PhotoWithoutGpsData_IsReportedAsNoGpsData()
    {
        CreatePhoto("no-gps.jpg");
        var reader = new FakeGpsReader(new Dictionary<string, GpsCoordinate>());

        var sorter = new PhotoSorter(reader);
        var results = sorter.SortPhotos(new[] { _sourceFolder }, _outputFolder, AssetCentre).ToList();

        var result = Assert.Single(results);
        Assert.Equal(PhotoSortStatus.NoGpsData, result.Status);
        Assert.False(Directory.Exists(Path.Combine(_outputFolder, "North")));
    }

    [Fact]
    public void UnsupportedFileExtensions_AreSkipped()
    {
        CreatePhoto("notes.txt");
        var reader = new FakeGpsReader(new Dictionary<string, GpsCoordinate>());

        var sorter = new PhotoSorter(reader);
        var results = sorter.SortPhotos(new[] { _sourceFolder }, _outputFolder, AssetCentre).ToList();

        Assert.Empty(results);
    }

    [Fact]
    public void DuplicateFileNamesInSameSector_AreNotOverwritten()
    {
        string subfolder = Directory.CreateDirectory(Path.Combine(_sourceFolder, "sub")).FullName;
        CreatePhoto("photo.jpg", _sourceFolder);
        CreatePhoto("photo.jpg", subfolder);

        var reader = new FakeGpsReader(new Dictionary<string, GpsCoordinate>
        {
            ["photo.jpg"] = new GpsCoordinate(10, 0), // both -> North
        });

        var sorter = new PhotoSorter(reader);
        var results = sorter.SortPhotos(new[] { _sourceFolder }, _outputFolder, AssetCentre, includeSubfolders: true).ToList();

        Assert.Equal(2, results.Count);
        Assert.All(results, r => Assert.Equal(PhotoSortStatus.Sorted, r.Status));

        Assert.True(File.Exists(Path.Combine(_outputFolder, "North", "photo.jpg")));
        Assert.True(File.Exists(Path.Combine(_outputFolder, "North", "photo (1).jpg")));
    }

    [Fact]
    public void MixOfLooseFilesAndFolders_AreAllSorted()
    {
        // This is the shape a real drag-and-drop of "a few loose photos plus a folder" produces.
        string looseFile = CreatePhoto("loose.jpg");
        string subfolder = Directory.CreateDirectory(Path.Combine(_sourceFolder, "batch")).FullName;
        string folderedFile = CreatePhoto("foldered.jpg", subfolder);

        var reader = new FakeGpsReader(new Dictionary<string, GpsCoordinate>
        {
            ["loose.jpg"] = new GpsCoordinate(10, 0),   // North
            ["foldered.jpg"] = new GpsCoordinate(0, 10), // East
        });

        var sorter = new PhotoSorter(reader);
        var results = sorter.SortPhotos(new[] { looseFile, subfolder }, _outputFolder, AssetCentre).ToList();

        Assert.Equal(2, results.Count);
        Assert.True(File.Exists(Path.Combine(_outputFolder, "North", "loose.jpg")));
        Assert.True(File.Exists(Path.Combine(_outputFolder, "East", "foldered.jpg")));
    }

    [Fact]
    public void OverlappingPaths_DoNotSortTheSameFileTwice()
    {
        string filePath = CreatePhoto("photo.jpg");
        var reader = new FakeGpsReader(new Dictionary<string, GpsCoordinate>
        {
            ["photo.jpg"] = new GpsCoordinate(10, 0),
        });

        var sorter = new PhotoSorter(reader);
        // The same file reachable both directly and via its containing folder.
        var results = sorter.SortPhotos(new[] { filePath, _sourceFolder }, _outputFolder, AssetCentre).ToList();

        Assert.Single(results);
    }
}
