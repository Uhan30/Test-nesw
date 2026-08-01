namespace GeoCompassSort.Core;

/// <summary>
/// One of the 8 compass sectors, each spanning 45 degrees and centred on its
/// named direction (e.g. North covers bearings 337.5 through 22.5 degrees).
/// </summary>
public enum CompassSector
{
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest,
}

public static class CompassSectorExtensions
{
    /// <summary>The folder name used for each sector, matching the requested naming convention.</summary>
    public static string ToFolderName(this CompassSector sector) => sector switch
    {
        CompassSector.North => "North",
        CompassSector.NorthEast => "North-East",
        CompassSector.East => "East",
        CompassSector.SouthEast => "South-East",
        CompassSector.South => "South",
        CompassSector.SouthWest => "South-West",
        CompassSector.West => "West",
        CompassSector.NorthWest => "North-West",
        _ => throw new ArgumentOutOfRangeException(nameof(sector)),
    };

    /// <summary>
    /// Classifies a compass bearing (0-360, where 0 = true North) into one of the
    /// 8 sectors. Each sector is a 45-degree wedge centred on its direction, so the
    /// boundary between two sectors sits at the midpoint between them (e.g. North/
    /// North-East split at 22.5 degrees).
    /// </summary>
    public static CompassSector ToCompassSector(this double bearingDegrees)
    {
        double normalized = ((bearingDegrees % 360) + 360) % 360;
        int index = (int)Math.Floor((normalized + 22.5) / 45.0) % 8;
        return (CompassSector)index;
    }
}
