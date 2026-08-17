#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using System.Collections.Generic;
using Tessera.Games.AugmentedYacht;

namespace Tessera.EditorTools
{
    public static class RebuildTableLayoutMenu
    {
        [MenuItem("Tools/Tessera/Rebuild Tabletop Layout")]
        public static void RebuildLayout()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("플레이 모드 중에는 에디터 레이아웃 재구성을 실행할 수 없습니다.");
                return;
            }
            // 1. Hierarchy 상의 모든 종이 및 구버전 오브젝트 영구 삭제
            string[] targets = { "Paper", "Score Sheet", "Game Info", "Burgundy", "Medieval Wood Planks Table", "Emerald Wide Runner", "Emerald Ribbon Runner" };
            GameObject[] allObjects = Resources.FindObjectsOfTypeAll<GameObject>();
            List<GameObject> toDelete = new();

            foreach (GameObject obj in allObjects)
            {
                if (obj == null || EditorUtility.IsPersistent(obj)) continue;
                foreach (string target in targets)
                {
                    if (obj.name.Contains(target))
                    {
                        toDelete.Add(obj);
                        break;
                    }
                }
            }

            foreach (GameObject obj in toDelete)
            {
                if (obj != null)
                {
                    Undo.DestroyObjectImmediate(obj);
                }
            }

            // 2. AugmentedYachtController 재구성
            AugmentedYachtController controller = Object.FindFirstObjectByType<AugmentedYachtController>();
            if (controller == null)
            {
                Debug.LogWarning("씬에서 AugmentedYachtController를 찾을 수 없습니다.");
                return;
            }

            Undo.RegisterFullObjectHierarchyUndo(controller.gameObject, "Rebuild Dice Board Layout");
            controller.RebuildLayoutMenu();
            EditorUtility.SetDirty(controller.gameObject);
            EditorSceneManager.MarkSceneDirty(controller.gameObject.scene);
            Debug.Log("🎲 종이 오브젝트 영구 제거 및 3D 원목 테이블 레이아웃 재구성이 완료되었습니다!");
        }
    }
}
#endif
