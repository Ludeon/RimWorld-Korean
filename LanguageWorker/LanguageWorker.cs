using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using Verse;

namespace RimWorld_Korean
{
  class LanguageWorker_Korean : LanguageWorker
  {
    private static readonly StringBuilder tmpStringBuilder = new StringBuilder();

    private static readonly Dictionary<string, (string, string)> JosaPatternPaired = new Dictionary<string, (string, string)>
        {
            {
                "(이)가",
                ("이", "가")
            },
            {
                "(와)과",
                ("과", "와")
            },
            {
                "(을)를",
                ("을", "를")
            },
            {
                "(은)는",
                ("은", "는")
            },
            {
                "(아)야",
                ("아", "야")
            },
            {
                "(이)어",
                ("이어", "여")
            },
            {
                "(으)로",
                ("으로", "로")
            },
            {
                "(이)",
                ("이", String.Empty)
            }
        };

    private static readonly HashSet<char> AlphabetEndPattern = new HashSet<char>
        {
            'b',
            'c',
            'k',
            'l',
            'm',
            'n',
            'p',
            'q',
            't'
        };

    private static readonly Regex JosaPattern = new Regex(@"\(이\)가|\(와\)과|\(을\)를|\(은\)는|\(아\)야|\(이\)어|\(으\)로|\(이\)", RegexOptions.Compiled);

    // (* or <
    private static readonly Regex TagOrNodeOpeningPattern = new Regex(@"\(\*|<", RegexOptions.Compiled);

    // (/Tag) or </Node>
    private static readonly Regex TagOrNodeClosingPattern = new Regex(@"(\(|<)\/\w+(\)|>)", RegexOptions.Compiled);

    public LanguageWorker_Korean() {
      Log.Message("LanguageWorker_Korean working.");
    }

    public override string PostProcessed(string str)
    {
      return ReplaceJosa(base.PostProcessed(str));
    }

    public override string PostProcessedKeyedTranslation(string translation)
    {
      return ReplaceJosa(base.PostProcessedKeyedTranslation(translation));
    }

    private string ReplaceJosa(string src)
    {
      tmpStringBuilder.Length = 0;

      var stripped = StripTags(src);

      var matches = JosaPattern.Matches(src);
      var matchesStripped = JosaPattern.Matches(stripped);

      var lastHeadIndex = 0;

      for (var i = 0; i < matches.Count; i++)
      {
        var match = matches[i];
        var matchStripped = matchesStripped[i];
        var matchValue = match.Value;

        var josaPair = JosaPatternPaired[matchValue];
        tmpStringBuilder.Append(src, lastHeadIndex, match.Index - lastHeadIndex);

        // do not process "rule->(은)는"
        if (matchStripped.Index == 0)
        {
          tmpStringBuilder.Append(matchValue);
        }
        else
        {
          var lastChar = stripped[matchStripped.Index - 1];

          // do not process "%%deityname%%(은)는" or any other similar special tokens
          if (Char.IsLetterOrDigit(lastChar))
          {
            var shouldUseJongJosa = matchValue == "(으)로" ? HasJongExceptRieul(lastChar) : HasJong(lastChar);
            var josaToAppend = shouldUseJongJosa ? josaPair.Item1 : josaPair.Item2;
            tmpStringBuilder.Append(josaToAppend);
          }
          else
          {
            tmpStringBuilder.Append(matchValue);
          }
        }

        lastHeadIndex = match.Index + match.Length;
      }

      tmpStringBuilder.Append(src, lastHeadIndex, src.Length - lastHeadIndex);

      return tmpStringBuilder.ToString();
    }

    private string StripTags(string inString)
    {
      var outString = inString;
      // Find an opening since it's much easier
      if (TagOrNodeOpeningPattern.Match(outString).Success)
      {
        // Only need to strip closings, we only care about the word before josa
        return TagOrNodeClosingPattern.Replace(outString, String.Empty);
      }
      return outString;
    }

    private bool HasJong(char inChar)
    {
      if (!IsKorean(inChar))
      {
        return AlphabetEndPattern.Contains(inChar);
      }

      return ExtractJongCode(inChar) > 0;
    }

    private bool HasJongExceptRieul(char inChar)
    {
      if (!IsKorean(inChar))
      {
        return inChar != 'l' && AlphabetEndPattern.Contains(inChar);
      }

      var jongCode = ExtractJongCode(inChar);
      return jongCode != 8 && jongCode != 0;
    }

    private int ExtractJongCode(char inChar)
    {
      return (inChar - 0xAC00) % 28;
    }

    private bool IsKorean(char inChar)
    {
      return inChar >= 0xAC00 && inChar <= 0xD7A3;
    }
  }
}
