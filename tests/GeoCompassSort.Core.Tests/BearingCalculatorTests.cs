using GeoCompassSort.Core;

namespace GeoCompassSort.Core.Tests;

public class BearingCalculatorTests
{
    private static readonly GpsCoordinate Origin = new(0, 0);

    [Fact]
    public void DuePointDirectlyNorth_BearsZero()
    {
        var north = new GpsCoordinate(10, 0);
        double bearing = BearingCalculator.CalculateInitialBearing(Origin, north);
        Assert.Equal(0, bearing, precision: 3);
    }

    [Fact]
    public void PointDirectlyEast_BearsNinety()
    {
        var east = new GpsCoordinate(0, 10);
        double bearing = BearingCalculator.CalculateInitialBearing(Origin, east);
        Assert.Equal(90, bearing, precision: 3);
    }

    [Fact]
    public void PointDirectlySouth_BearsOneEighty()
    {
        var south = new GpsCoordinate(-10, 0);
        double bearing = BearingCalculator.CalculateInitialBearing(Origin, south);
        Assert.Equal(180, bearing, precision: 3);
    }

    [Fact]
    public void PointDirectlyWest_BearsTwoSeventy()
    {
        var west = new GpsCoordinate(0, -10);
        double bearing = BearingCalculator.CalculateInitialBearing(Origin, west);
        Assert.Equal(270, bearing, precision: 3);
    }

    [Fact]
    public void PointNorthEastOfCentre_BearsBetweenZeroAndNinety()
    {
        var northEast = new GpsCoordinate(10, 10);
        double bearing = BearingCalculator.CalculateInitialBearing(Origin, northEast);
        Assert.InRange(bearing, 0, 90);
        Assert.True(Math.Abs(bearing - 45) < 2, $"Expected close to 45 degrees, got {bearing}");
    }

    [Fact]
    public void SamePoint_BearingIsZero()
    {
        double bearing = BearingCalculator.CalculateInitialBearing(Origin, Origin);
        Assert.Equal(0, bearing, precision: 3);
    }
}
