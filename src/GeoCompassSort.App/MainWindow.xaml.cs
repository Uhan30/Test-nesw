using System.Collections.ObjectModel;
using GeoCompassSort.Core;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Storage.Pickers;
using WinRT.Interop;

namespace GeoCompassSort.App;

public sealed partial class MainWindow : Window
{
    private readonly ObservableCollection<PhotoResultViewModel> _results = new();
    private readonly PhotoSorter _photoSorter = new();

    private string? _sourceFolderPath;
    private string? _outputFolderPath;

    public MainWindow()
    {
        InitializeComponent();
        ResultsList.ItemsSource = _results;
    }

    private async void OnBrowseSourceFolder(object sender, RoutedEventArgs e)
    {
        string? folder = await PickFolderAsync();
        if (folder is null)
        {
            return;
        }

        _sourceFolderPath = folder;
        SourceFolderBox.Text = folder;

        // Default the output folder to a "Sorted" subfolder next to the source, if not already set.
        if (string.IsNullOrWhiteSpace(_outputFolderPath))
        {
            _outputFolderPath = System.IO.Path.Combine(folder, "Sorted");
            OutputFolderBox.Text = _outputFolderPath;
        }
    }

    private async void OnBrowseOutputFolder(object sender, RoutedEventArgs e)
    {
        string? folder = await PickFolderAsync();
        if (folder is null)
        {
            return;
        }

        _outputFolderPath = folder;
        OutputFolderBox.Text = folder;
    }

    private async Task<string?> PickFolderAsync()
    {
        var picker = new FolderPicker
        {
            SuggestedStartLocation = PickerLocationId.PicturesLibrary,
        };
        picker.FileTypeFilter.Add("*");

        // A FolderPicker must be attached to the app's window via its HWND.
        IntPtr hwnd = WindowNative.GetWindowHandle(this);
        InitializeWithWindow.Initialize(picker, hwnd);

        var folder = await picker.PickSingleFolderAsync();
        return folder?.Path;
    }

    private async void OnSortClicked(object sender, RoutedEventArgs e)
    {
        if (!TryGetCentre(out var centre, out string? validationError))
        {
            ShowStatus(validationError!, InfoBarSeverity.Error);
            return;
        }

        if (string.IsNullOrWhiteSpace(_sourceFolderPath))
        {
            ShowStatus("Choose a source folder of photos first.", InfoBarSeverity.Error);
            return;
        }

        if (string.IsNullOrWhiteSpace(_outputFolderPath))
        {
            ShowStatus("Choose an output folder first.", InfoBarSeverity.Error);
            return;
        }

        SortButton.IsEnabled = false;
        Spinner.IsActive = true;
        _results.Clear();
        SummaryText.Text = "Sorting…";
        StatusBar.IsOpen = false;

        string sourceFolder = _sourceFolderPath;
        string outputFolder = _outputFolderPath;
        bool includeSubfolders = IncludeSubfoldersBox.IsChecked == true;

        try
        {
            var results = await Task.Run(() =>
                _photoSorter.SortPhotos(sourceFolder, outputFolder, centre, includeSubfolders).ToList());

            foreach (var result in results)
            {
                _results.Add(new PhotoResultViewModel(result));
            }

            int sorted = results.Count(r => r.Status == PhotoSortStatus.Sorted);
            int noGps = results.Count(r => r.Status == PhotoSortStatus.NoGpsData);
            int errors = results.Count(r => r.Status == PhotoSortStatus.Error);

            SummaryText.Text = results.Count == 0
                ? "No supported photos were found in that folder."
                : $"{sorted} sorted, {noGps} skipped (no GPS data), {errors} errors — out of {results.Count} photo(s).";

            ShowStatus($"Done. Sorted photos are in \"{outputFolder}\".", InfoBarSeverity.Success);
        }
        catch (Exception ex)
        {
            ShowStatus($"Sorting failed: {ex.Message}", InfoBarSeverity.Error);
            SummaryText.Text = "No photos sorted yet.";
        }
        finally
        {
            SortButton.IsEnabled = true;
            Spinner.IsActive = false;
        }
    }

    private bool TryGetCentre(out GpsCoordinate centre, out string? error)
    {
        centre = default;
        error = null;

        if (double.IsNaN(LatitudeBox.Value) || double.IsNaN(LongitudeBox.Value))
        {
            error = "Enter the asset centre's latitude and longitude.";
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

    private void ShowStatus(string message, InfoBarSeverity severity)
    {
        StatusBar.Message = message;
        StatusBar.Severity = severity;
        StatusBar.IsOpen = true;
    }
}

/// <summary>Presentation wrapper so <see cref="PhotoSortResult"/> can be bound directly in the results list.</summary>
public sealed class PhotoResultViewModel
{
    public PhotoResultViewModel(PhotoSortResult result)
    {
        SourcePath = result.SourcePath;
        FileName = System.IO.Path.GetFileName(result.SourcePath);
        StatusText = result.Status switch
        {
            PhotoSortStatus.Sorted => "Sorted",
            PhotoSortStatus.NoGpsData => "No GPS data",
            PhotoSortStatus.Error => $"Error: {result.ErrorMessage}",
            _ => result.Status.ToString(),
        };
        SectorText = result.Sector?.ToFolderName() ?? "—";
        BearingText = result.BearingDegrees is { } bearing ? $"{bearing:0.0}°" : "—";
    }

    public string SourcePath { get; }
    public string FileName { get; }
    public string StatusText { get; }
    public string SectorText { get; }
    public string BearingText { get; }
}
