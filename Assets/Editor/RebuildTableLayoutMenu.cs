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

            // 1. Hierarchy 상의 구버전 종이 및 2D UI 오브젝트 영구 삭제
            string[] targets = { "Paper", "Game Info", "Burgundy", "Medieval Wood Planks Table", "Emerald Wide Runner", "Emerald Ribbon Runner", "Inkwell", "Quill" };
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

            // 2. Full Field World Camera를 게임 실행 시와 동일한 75도 직교 뷰로 동기화
            GameObject camObj = GameObject.Find("Full Field World Camera");
            if (camObj != null)
            {
                Camera cam = camObj.GetComponent<Camera>();
                if (cam != null)
                {
                    Undo.RecordObject(camObj.transform, "Align Camera to 75 deg Game View");
                    Undo.RecordObject(cam, "Set Orthographic Camera");
                    camObj.transform.position = new Vector3(-0.39f, 11.5f, -3.1f);
                    camObj.transform.rotation = Quaternion.Euler(75.0f, 0f, 0f);
                    cam.orthographic = true;
                    cam.orthographicSize = 8.2f;
                    cam.nearClipPlane = 0.1f;
                    cam.farClipPlane = 40f;
                    cam.clearFlags = CameraClearFlags.SolidColor;
                    cam.backgroundColor = new Color(0.06f, 0.045f, 0.04f);
                    EditorUtility.SetDirty(camObj);
                    EditorUtility.SetDirty(cam);
                }
            }

            // 3. AugmentedYachtController 레이아웃 재구성 (모래시계, 족보 시트 및 족보 UI 아이템 일괄 생성)
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
            EditorSceneManager.SaveScene(controller.gameObject.scene);
            AssetDatabase.SaveAssets();
            Debug.Log("🎲 족보 아이템, 3D 모래시계, 깃털 펜 및 75도 게임 뷰 레이아웃 재구성 및 씬 저장이 완료되었습니다!");
        }
    }
}
#endif
