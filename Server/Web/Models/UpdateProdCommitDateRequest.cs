namespace Server.Models;

public sealed class ProdCommitDateUpdateItem
{
    public int LineId { get; set; }
    public string? RsvSource { get; set; }
    public string SelectedMonth { get; set; } = string.Empty;
}

public sealed class UpdateProdCommitDateRequest
{
    public List<ProdCommitDateUpdateItem> Updates { get; set; } = [];
}
