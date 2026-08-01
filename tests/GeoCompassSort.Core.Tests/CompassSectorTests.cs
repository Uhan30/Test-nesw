using GeoCompassSort.Core;

namespace GeoCompassSort.Core.Tests;

public class CompassSectorTests
{
    [Theory]
    [InlineData(0, CompassSector.North)]
    [InlineData(22.4, CompassSector.North)]
    [InlineData(22.5, CompassSector.NorthEast)]
    [InlineData(45, CompassSector.NorthEast)]
    [InlineData(67.4, CompassSector.NorthEast)]
    [InlineData(67.5, CompassSector.East)]
    [InlineData(90, CompassSector.East)]
    [InlineData(112.5, CompassSector.SouthEast)]
    [InlineData(135, CompassSector.SouthEast)]
    [InlineData(157.5, CompassSector.South)]
    [InlineData(180, CompassSector.South)]
    [InlineData(202.5, CompassSector.SouthWest)]
    [InlineData(225, CompassSector.SouthWest)]
    [InlineData(247.5, CompassSector.West)]
    [InlineData(270, CompassSector.West)]
    [InlineData(292.5, CompassSector.NorthWest)]
    [InlineData(315, CompassSector.NorthWest)]
    [InlineData(337.4, CompassSector.NorthWest)]
    [InlineData(337.5, CompassSector.North)]
    [InlineData(359.9, CompassSector.North)]
    [InlineData(360, CompassSector.North)]
    public void ClassifiesBearingIntoExpectedSector(double bearing, CompassSector expected)
    {
        Assert.Equal(expected, bearing.ToCompassSector());
    }

    [Theory]
    [InlineData(-10, CompassSector.North)] // -10 normalizes to 350
    [InlineData(-45, CompassSector.NorthWest)] // -45 normalizes to 315
    [InlineData(720, CompassSector.North)] // wraps twice
    public void NormalizesOutOfRangeBearings(double bearing, CompassSector expected)
    {
        Assert.Equal(expected, bearing.ToCompassSector());
    }

    [Theory]
    [InlineData(CompassSector.North, "North")]
    [InlineData(CompassSector.NorthEast, "North-East")]
    [InlineData(CompassSector.East, "East")]
    [InlineData(CompassSector.SouthEast, "South-East")]
    [InlineData(CompassSector.South, "South")]
    [InlineData(CompassSector.SouthWest, "South-West")]
    [InlineData(CompassSector.West, "West")]
    [InlineData(CompassSector.NorthWest, "North-West")]
    public void FolderNameMatchesConvention(CompassSector sector, string expectedFolderName)
    {
        Assert.Equal(expectedFolderName, sector.ToFolderName());
    }
}
