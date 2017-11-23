using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;

// https://github.com/myevan/csjosa

namespace LT
{
    internal struct JosaPair
    {
        public readonly string josa1, josa2;

        public JosaPair(string josa1, string josa2)
        {
            this.josa1 = josa1;
            this.josa2 = josa2;
        }
    }

    internal static class Josa
    {
        private static readonly Regex josaPattern;
        private static readonly Dictionary<string, JosaPair> josaPatternPaired;
        private static readonly List<char> alphabetEndPattern;

        static Josa()
        {
            josaPattern = new Regex(@"\(이\)가|\(와\)과|\(을\)를|\(은\)는|\(아\)야|\(이\)여|\(으\)로|\(이\)라");
            josaPatternPaired = new Dictionary<string, JosaPair>
            {
                {"(이)가", new JosaPair("이", "가")},
                {"(와)과", new JosaPair("과", "와")},
                {"(을)를", new JosaPair("을", "를")},
                {"(은)는", new JosaPair("은", "는")},
                {"(아)야", new JosaPair("아", "야")},
                {"(이)여", new JosaPair("이여", "여")},
                {"(으)로", new JosaPair("으로", "로")},
                {"(이)라", new JosaPair("이라", "라")}
            };
            alphabetEndPattern = new List<char> { 'b', 'c', 'k', 'l', 'm', 'n', 'p', 'q', 't' };
        }

        public static string ReplaceJosa(this string src)
        {
            var str = new StringBuilder(src.Length);
            var josaMatches = josaPattern.Matches(src);
            var lastHeadIndex = 0;
            foreach (Match josaMatch in josaMatches)
            {
                var matchingPair = josaPatternPaired[josaMatch.Value];

                str.Append(src, lastHeadIndex, josaMatch.Index - lastHeadIndex);
                if (josaMatch.Index > 0)
                {
                    var prevChar = src[josaMatch.Index - 1];
                    if (josaMatch.Value != "(으)로" && HasJong(prevChar) ||
                        josaMatch.Value == "(으)로" && HasJongExceptRieul(prevChar))
                    {
                        str.Append(matchingPair.josa1);
                    }
                    else
                    {
                        str.Append(matchingPair.josa2);
                    }
                }
                else
                {
                    str.Append(matchingPair.josa1);
                }

                lastHeadIndex = josaMatch.Index + josaMatch.Length;
            }
            str.Append(src, lastHeadIndex, src.Length - lastHeadIndex);
            return str.ToString();
        }

        private static bool HasJong(char inChar)
        {
            if (! IsKorean(inChar)) return alphabetEndPattern.Contains(inChar);
            var localCode = inChar - 0xAC00; // 가~ 이후 로컬 코드 
            var jongCode = localCode % 28;
            return jongCode > 0;
        }

        private static bool HasJongExceptRieul(char inChar)
        {
            if (! IsKorean(inChar)) return false;
            var localCode = inChar - 0xAC00;
            var jongCode = localCode % 28;
            return jongCode != 8 && jongCode != 0;
        }

        private static bool IsKorean(char inChar)
        {
            return inChar >= 0xAC00 && inChar <= 0xD7A3;
        }
    }
}