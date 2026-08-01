namespace GeoCompassSort.Core;

public enum PhotoSortStatus
{
    Sorted,
    NoGpsData,
    Error,
}

/// <summary>The outcome of attempting to sort a single photo by compass sector.</summary>
public sealed record PhotoSortResult(
    string SourcePath,
    PhotoSortStatus Status,
    GpsCoordinate? CameraPosition = null,
    double? BearingDegrees = null,
    CompassSector? Sector = null,
    string? DestinationPath = null,
    string? ErrorMessage = null);
