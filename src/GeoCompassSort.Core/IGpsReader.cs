namespace GeoCompassSort.Core;

/// <summary>Abstraction over reading a camera's GPS position from a photo file.</summary>
public interface IGpsReader
{
    bool IsSupportedImage(string filePath);

    bool TryReadGpsCoordinate(string filePath, out GpsCoordinate coordinate);
}
