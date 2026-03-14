namespace PlzBuyMe.Api.Utils;

public static class StringUtils
{
    /// <summary>Converts PascalCase to snake_case for API/DB compatibility.</summary>
    public static string ToSnakeCase(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        var result = new System.Text.StringBuilder();
        for (int i = 0; i < value.Length; i++)
        {
            var c = value[i];
            if (char.IsUpper(c) && i > 0)
                result.Append('_');
            result.Append(char.ToLowerInvariant(c));
        }
        return result.ToString();
    }
}
