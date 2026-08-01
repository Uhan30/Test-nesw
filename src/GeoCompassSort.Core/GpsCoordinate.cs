namespace GeoCompassSort.Core;

/// <summary>A WGS-84 latitude/longitude pair in decimal degrees.</summary>
public readonly record struct GpsCoordinate(double Latitude, double Longitude)
{
    public static GpsCoordinate? TryCreate(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180)
        {
            return null;
        }

        return new GpsCoordinate(latitude, longitude);
    }
}
