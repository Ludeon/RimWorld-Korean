using System.Reflection;
using Harmony;
using LT;
using RimWorld;
using Verse;

namespace Verse
{
    class LanguageWorker_Korean : LanguageWorker
    {
        public override string PostProcessed(string str)
        {
            return str.ReplaceJosa();
        }
    }
}

namespace LT
{
    [StaticConstructorOnStartup]
    static class Main
    {
        static Main()
        {
            var h = HarmonyInstance.Create("com.ludeon.rimworld-korean");
            h.PatchAll(Assembly.GetExecutingAssembly());
            Log.Message("한국어 미리적용: 패치 완료!");
        }
    }

    [HarmonyPatch(typeof(Backstory), "FullDescriptionFor")]
    static class BackstoryPatch
    {
        static void Postfix(ref string __result)
        {
            __result = __result.ReplaceJosa();
        }
    }

    [HarmonyPatch(typeof(Translator), "Translate", new[] {typeof(string), typeof(object[])})]
    static class TranslatorPatch
    {
        static void Postfix(ref string __result)
        {
            __result = __result.ReplaceJosa();
        }
    }
}
