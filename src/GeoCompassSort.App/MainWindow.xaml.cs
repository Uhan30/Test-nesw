using System.Collections.ObjectModel;
using System.Globalization;
using GeoCompassSort.Core;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage.Pickers;
using WinRT.Interop;

namespace GeoCompassSort.App;

public sealed partial class MainWindow : Window
{
    private static readonly SolidColorBrush DragHoverBrush = new(Windows.UI.Color.FromArgb(255, 0, 120, 215));

    private readonly ObservableCollection<PhotoResultViewModel> _issues = new();
    private readonly PhotoSorter _photoSorter = new();
    private readonly Dictionary<CompassSector, int> _sectorCounts = Enum.GetValues<CompassSector>()
        .ToDictionary(sector => sector, _ => 0);

    private readonly Brush _defaultDropZoneBrush;
    private string? _outputFolderPath;
    private int _totalSorted;

    public MainWindow()
    {
        InitializeComponent();
        Title = "Geotagged Photo Compass Sort";
        IssuesList.ItemsSource = _issues;
        _defaultDropZoneBrush = DropZoneBorder.BorderBrush;
    }

    private void OnDragOver(object sender, DragEventArgs e)
    {
        if (e.DataView.Contains(StandardDataFormats.StorageItems))
        {
            e.AcceptedOperation = DataPackageOperation.Copy;
            e.DragUIOverride.Caption = "Sort these photos";
            e.DragUIOverride.IsGlyphVisible = true;
            DropZoneBorder.BorderBrush = DragHoverBrush;
            AnimateDropZoneScale(1.03);
        }
        else
        {
            e.AcceptedOperation = DataPackageOperation.None;
        }
    }

    private void OnDragLeave(object sender, DragEventArgs e)
    {
        DropZoneBorder.BorderBrush = _defaultDropZoneBrush;
        AnimateDropZoneScale(1.0);
    }

    private async void OnDrop(object sender, DragEventArgs e)
    {
        DropZoneBorder.BorderBrush = _defaultDropZoneBrush;
        AnimateDropZoneScale(1.0);

        if (!e.DataView.Contains(StandardDataFormats.StorageItems))
        {
            return;
        }

        var items = await e.DataView.GetStorageItemsAsync();
        var paths = items.Select(item => item.Path).Where(path => !string.IsNullOrEmpty(path)).ToList();
        await ProcessDroppedPathsAsync(paths);
    }

    private async void OnDropZoneTapped(object sender, Microsoft.UI.Xaml.Input.TappedRoutedEventArgs e)
    {
        var picker = new FileOpenPicker
        {
            ViewMode = PickerViewMode.Thumbnail,
            SuggestedStartLocation = PickerLocationId.PicturesLibrary,
        };
        foreach (var extension in new[] { ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif", ".webp" })
        {
            picker.FileTypeFilter.Add(extension);
        }

        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(this));

        var files = await picker.PickMultipleFilesAsync();
        if (files is { Count: > 0 })
        {
            await ProcessDroppedPathsAsync(files.Select(f => f.Path).ToList());
        }
    }

    private async Task ProcessDroppedPathsAsync(List<string> paths)
    {
        if (paths.Count == 0)
        {
            return;
        }

        if (!TryGetCentre(out var centre, out string? centreError))
        {
            ShowStatus(centreError!, InfoBarSeverity.Error);
            return;
        }

        EnsureOutputFolder(paths);

        Spinner.IsActive = true;
        DropStatusText.Text = "Sorting…";

        try
        {
            string outputFolder = _outputFolderPath!;
            var results = await Task.Run(() =>
                _photoSorter.SortPhotos(paths, outputFolder, centre, includeSubfolders: true).ToList());

            ApplyResults(results);

            DropStatusText.Text = results.Count == 0
                ? "No supported photos were found in what you dropped."
                : $"Just sorted {results.Count} photo(s). Drop more anytime.";
        }
        catch (Exception ex)
        {
            ShowStatus($"Sorting failed: {ex.Message}", InfoBarSeverity.Error);
            DropStatusText.Text = string.Empty;
        }
        finally
        {
            Spinner.IsActive = false;
        }
    }

    private void EnsureOutputFolder(List<string> paths)
    {
        if (_outputFolderPath is not null)
        {
            return;
        }

        // If exactly one folder was dropped, sort into a "Sorted" subfolder right next to it.
        // Otherwise (loose files, or several items), fall back to a predictable default in Pictures.
        string? singleFolder = paths.Count == 1 && System.IO.Directory.Exists(paths[0]) ? paths[0] : null;

        _outputFolderPath = singleFolder is not null
            ? System.IO.Path.Combine(singleFolder, "Sorted")
            : System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "GeoCompassSort Sorted");

        OutputFolderText.Text = $"Output folder: {_outputFolderPath}";
    }

    private async void OnChangeOutputFolder(object sender, RoutedEventArgs e)
    {
        var picker = new FolderPicker
        {
            SuggestedStartLocation = PickerLocationId.PicturesLibrary,
        };
        picker.FileTypeFilter.Add("*");
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(this));

        var folder = await picker.PickSingleFolderAsync();
        if (folder is null)
        {
            return;
        }

        _outputFolderPath = folder.Path;
        OutputFolderText.Text = $"Output folder: {_outputFolderPath}";
    }

    private void OnResetSession(object sender, RoutedEventArgs e)
    {
        foreach (var sector in _sectorCounts.Keys.ToList())
        {
            _sectorCounts[sector] = 0;
        }

        _totalSorted = 0;
        _issues.Clear();
        _outputFolderPath = null;

        UpdateSectorCounters();
        OutputFolderText.Text = "Output folder: chosen automatically on first drop";
        SummaryText.Text = "Drop some geotagged photos to get started.";
        DropStatusText.Text = string.Empty;
        OpenOutputButton.Visibility = Visibility.Collapsed;
        IssuesExpander.Visibility = Visibility.Collapsed;
        StatusBar.IsOpen = false;
    }

    private void OnOpenOutputFolder(object sender, RoutedEventArgs e)
    {
        if (_outputFolderPath is null || !System.IO.Directory.Exists(_outputFolderPath))
        {
            return;
        }

        try
        {
            // GeoCompassSort.App runs as a full-trust packaged app, so a plain
            // Explorer launch works without any Windows.Storage broker access.
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = _outputFolderPath,
                UseShellExecute = true,
            });
        }
        catch (Exception ex)
        {
            ShowStatus($"Couldn't open the output folder: {ex.Message}", InfoBarSeverity.Warning);
        }
    }

    private async void OnPasteCoordinates(object sender, RoutedEventArgs e)
    {
        try
        {
            var content = Clipboard.GetContent();
            if (!content.Contains(StandardDataFormats.Text))
            {
                ShowStatus("Clipboard doesn't contain text.", InfoBarSeverity.Warning);
                return;
            }

            string text = await content.GetTextAsync();
            var parts = text.Split(new[] { ',', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (parts.Length < 2
                || !double.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out double lat)
                || !double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out double lon))
            {
                ShowStatus("Couldn't parse coordinates from the clipboard. Expected something like \"53.4808, -2.2426\".", InfoBarSeverity.Warning);
                return;
            }

            LatitudeBox.Value = lat;
            LongitudeBox.Value = lon;
            StatusBar.IsOpen = false;
        }
        catch (Exception ex)
        {
            ShowStatus($"Couldn't read the clipboard: {ex.Message}", InfoBarSeverity.Warning);
        }
    }

    private bool TryGetCentre(out GpsCoordinate centre, out string? error)
    {
        centre = default;
        error = null;

        if (double.IsNaN(LatitudeBox.Value) || double.IsNaN(LongitudeBox.Value))
        {
            error = "Enter the asset centre's latitude and longitude first.";
            return false;
        }

        var candidate = GpsCoordinate.TryCreate(LatitudeBox.Value, LongitudeBox.Value);
        if (candidate is null)
        {
            error = "Latitude must be between -90 and 90, and longitude between -180 and 180.";
            return false;
        }

        centre = candidate.Value;
        return true;
    }

    private void ApplyResults(List<PhotoSortResult> results)
    {
        foreach (var result in results)
        {
            if (result.Status == PhotoSortStatus.Sorted && result.Sector is { } sector)
            {
                _sectorCounts[sector]++;
                _totalSorted++;
            }
            else
            {
                _issues.Add(new PhotoResultViewModel(result));
            }
        }

        UpdateSectorCounters();

        SummaryText.Text = _issues.Count > 0
            ? $"{_totalSorted} sorted, {_issues.Count} skipped so far."
            : $"{_totalSorted} sorted so far.";

        if (_totalSorted > 0)
        {
            OpenOutputButton.Visibility = Visibility.Visible;
        }

        if (_issues.Count > 0)
        {
            IssuesExpander.Header = $"{_issues.Count} skipped or errored — click to view";
            IssuesExpander.Visibility = Visibility.Visible;
        }
    }

    private void UpdateSectorCounters()
    {
        CountNorth.Text = _sectorCounts[CompassSector.North].ToString();
        CountNorthEast.Text = _sectorCounts[CompassSector.NorthEast].ToString();
        CountEast.Text = _sectorCounts[CompassSector.East].ToString();
        CountSouthEast.Text = _sectorCounts[CompassSector.SouthEast].ToString();
        CountSouth.Text = _sectorCounts[CompassSector.South].ToString();
        CountSouthWest.Text = _sectorCounts[CompassSector.SouthWest].ToString();
        CountWest.Text = _sectorCounts[CompassSector.West].ToString();
        CountNorthWest.Text = _sectorCounts[CompassSector.NorthWest].ToString();
        TotalSortedText.Text = _totalSorted.ToString();

        HighlightCell(CellNorth, _sectorCounts[CompassSector.North]);
        HighlightCell(CellNorthEast, _sectorCounts[CompassSector.NorthEast]);
        HighlightCell(CellEast, _sectorCounts[CompassSector.East]);
        HighlightCell(CellSouthEast, _sectorCounts[CompassSector.SouthEast]);
        HighlightCell(CellSouth, _sectorCounts[CompassSector.South]);
        HighlightCell(CellSouthWest, _sectorCounts[CompassSector.SouthWest]);
        HighlightCell(CellWest, _sectorCounts[CompassSector.West]);
        HighlightCell(CellNorthWest, _sectorCounts[CompassSector.NorthWest]);
    }

    private static void HighlightCell(Border cell, int count)
    {
        cell.Background = count > 0
            ? (Brush)Application.Current.Resources["AccentFillColorSecondaryBrush"]
            : (Brush)Application.Current.Resources["CardBackgroundFillColorDefaultBrush"];
    }

    private void AnimateDropZoneScale(double scale)
    {
        var storyboard = new Storyboard();

        var scaleXAnimation = new DoubleAnimation
        {
            To = scale,
            Duration = new Duration(TimeSpan.FromMilliseconds(120)),
            EasingFunction = new QuadraticEase(),
        };
        Storyboard.SetTarget(scaleXAnimation, DropZoneScale);
        Storyboard.SetTargetProperty(scaleXAnimation, nameof(ScaleTransform.ScaleX));

        var scaleYAnimation = new DoubleAnimation
        {
            To = scale,
            Duration = new Duration(TimeSpan.FromMilliseconds(120)),
            EasingFunction = new QuadraticEase(),
        };
        Storyboard.SetTarget(scaleYAnimation, DropZoneScale);
        Storyboard.SetTargetProperty(scaleYAnimation, nameof(ScaleTransform.ScaleY));

        storyboard.Children.Add(scaleXAnimation);
        storyboard.Children.Add(scaleYAnimation);
        storyboard.Begin();
    }

    private void ShowStatus(string message, InfoBarSeverity severity)
    {
        StatusBar.Message = message;
        StatusBar.Severity = severity;
        StatusBar.IsOpen = true;
    }
}

/// <summary>Presentation wrapper so <see cref="PhotoSortResult"/> can be bound directly in the issues list.</summary>
public sealed class PhotoResultViewModel
{
    public PhotoResultViewModel(PhotoSortResult result)
    {
        SourcePath = result.SourcePath;
        FileName = System.IO.Path.GetFileName(result.SourcePath);
        StatusText = result.Status switch
        {
            PhotoSortStatus.NoGpsData => "No GPS data",
            PhotoSortStatus.Error => $"Error: {result.ErrorMessage}",
            _ => result.Status.ToString(),
        };
    }

    public string SourcePath { get; }
    public string FileName { get; }
    public string StatusText { get; }
}
