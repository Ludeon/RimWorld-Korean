using System;
using System.IO;
using System.Linq;
using System.Reflection;
using Verse;

namespace KoreanTranslationCleaner
{
    // Launched with `-ko-cleanup`, runs Dev mode's "Clean up translation files" without any dialog,
    // writes the result to <save data folder>/ko-cleanup-result.txt, then quits the game.
    [StaticConstructorOnStartup]
    public static class AutoCleanup
    {
        private const string Arg = "ko-cleanup";
        private const string ResultFileName = "ko-cleanup-result.txt";

        static AutoCleanup()
        {
            if (!GenCommandLine.CommandLineArgPassed(Arg))
            {
                return;
            }

            // Queue after the remaining startup events so every static constructor has run
            LongEventHandler.QueueLongEvent(Run, "CleaningTranslationFiles", false, null);
        }

        private static void Run()
        {
            string result;
            try
            {
                result = Cleanup();
            }
            catch (Exception ex)
            {
                result = "error: " + ex;
            }

            try
            {
                File.WriteAllText(Path.Combine(GenFilePaths.SaveDataFolderPath, ResultFileName), result);
            }
            catch (Exception ex)
            {
                Log.Error("[KoreanTranslationCleaner] Could not write result: " + ex);
            }

            Root.Shutdown();
        }

        private static string Cleanup()
        {
            LoadedLanguage lang = LanguageDatabase.activeLanguage;
            if (lang == null || lang == LanguageDatabase.defaultLanguage)
            {
                return "error: active language is not set to a non-English language (got " + lang?.folderName + ")";
            }

            if (lang.anyKeyedReplacementsXmlParseError || lang.anyDefInjectionsXmlParseError)
            {
                return "error: XML parse error in " +
                       (lang.lastKeyedReplacementsXmlParseErrorInFile ?? lang.lastDefInjectionsXmlParseErrorInFile);
            }

            lang.LoadData();

            int errorsBefore = CountErrors();

            // TranslationFilesCleaner.CleanupTranslationFiles() refuses to run with non-official mods (this one) active
            // and asks for confirmation, so call the actual worker directly.
            MethodInfo doCleanup = typeof(TranslationFilesCleaner).GetMethod(
                "DoCleanupTranslationFiles", BindingFlags.NonPublic | BindingFlags.Static);
            if (doCleanup == null)
            {
                return "error: TranslationFilesCleaner.DoCleanupTranslationFiles not found";
            }

            doCleanup.Invoke(null, null);

            int errors = CountErrors() - errorsBefore;
            if (errors > 0)
            {
                string messages = string.Join("\n", Log.Messages
                    .Where(m => m.type == LogMessageType.Error)
                    .Reverse()
                    .Take(errors)
                    .Reverse()
                    .Select(m => m.text));
                return "error: cleanup logged " + errors + " error(s)\n" + messages;
            }

            return "ok: " + lang.folderName;
        }

        private static int CountErrors()
        {
            using (Log.LockMessages())
            {
                return Log.Messages.Count(m => m.type == LogMessageType.Error);
            }
        }
    }
}
