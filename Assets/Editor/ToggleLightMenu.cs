#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using Tessera.Games.AugmentedYacht;

namespace Tessera.EditorTools
{
    public static class ToggleLightMenu
    {
        [MenuItem("Tools/Tessera/Toggle Key Light Preset")]
        public static void TogglePreset()
        {
            AugmentedYachtController controller = Object.FindFirstObjectByType<AugmentedYachtController>();
            if (controller != null)
            {
                controller.ToggleKeyLightPreset();
            }
        }
    }
}
#endif
