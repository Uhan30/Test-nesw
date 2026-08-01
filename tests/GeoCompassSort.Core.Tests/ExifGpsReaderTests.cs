using GeoCompassSort.Core;

namespace GeoCompassSort.Core.Tests;

public class ExifGpsReaderTests : IDisposable
{
    private readonly string _tempFolder = Directory.CreateTempSubdirectory("gcs-exif-").FullName;
    private readonly ExifGpsReader _reader = new();

    public void Dispose() => Directory.Delete(_tempFolder, recursive: true);

    [Theory]
    [InlineData("photo.jpg", true)]
    [InlineData("photo.JPEG", true)]
    [InlineData("photo.png", true)]
    [InlineData("notes.txt", false)]
    [InlineData("video.mp4", false)]
    public void IsSupportedImage_MatchesKnownExtensions(string fileName, bool expected)
    {
        Assert.Equal(expected, _reader.IsSupportedImage(fileName));
    }

    [Fact]
    public void TryReadGpsCoordinate_ReturnsFalse_ForCorruptOrNonImageFile()
    {
        string path = Path.Combine(_tempFolder, "corrupt.jpg");
        File.WriteAllText(path, "this is not a real jpeg");

        bool found = _reader.TryReadGpsCoordinate(path, out var coordinate);

        Assert.False(found);
        Assert.Equal(default, coordinate);
    }

    [Fact]
    public void TryReadGpsCoordinate_ReturnsFalse_WhenFileDoesNotExist()
    {
        string path = Path.Combine(_tempFolder, "missing.jpg");

        bool found = _reader.TryReadGpsCoordinate(path, out _);

        Assert.False(found);
    }
}
