namespace GeoCompassSort.Core;

/// <summary>Great-circle bearing calculations between WGS-84 coordinates.</summary>
public static class BearingCalculator
{
    /// <summary>
    /// Computes the initial great-circle bearing (forward azimuth), in degrees
    /// clockwise from true North (0-360), travelling from <paramref name="from"/>
    /// to <paramref name="to"/>.
    /// </summary>
    public static double CalculateInitialBearing(GpsCoordinate from, GpsCoordinate to)
    {
        double lat1 = DegreesToRadians(from.Latitude);
        double lat2 = DegreesToRadians(to.Latitude);
        double deltaLon = DegreesToRadians(to.Longitude - from.Longitude);

        double y = Math.Sin(deltaLon) * Math.Cos(lat2);
        double x = Math.Cos(lat1) * Math.Sin(lat2) -
                   Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(deltaLon);

        double bearingRadians = Math.Atan2(y, x);
        double bearingDegrees = RadiansToDegrees(bearingRadians);

        return (bearingDegrees + 360) % 360;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;

    private static double RadiansToDegrees(double radians) => radians * 180.0 / Math.PI;
}
