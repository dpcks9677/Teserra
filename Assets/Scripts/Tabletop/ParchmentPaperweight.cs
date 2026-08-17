using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 양피지 점수판 상단 여백을 지긋이 눌러주는 3D 묵직하고 진한 앤틱 황동 주괴 누름돌 (Heavy Aged Brass Ingot)
    /// </summary>
    public sealed class ParchmentPaperweight : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        public static ParchmentPaperweight Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Parchment Paperweight");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            ParchmentPaperweight comp = root.AddComponent<ParchmentPaperweight>();
            comp.BuildGeometry();
            return comp;
        }

        public void BuildGeometry()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                Transform child = transform.GetChild(i);
                if (child == null) continue;
                if (Application.isPlaying)
                {
                    child.SetParent(null);
                    Destroy(child.gameObject);
                }
                else
                {
                    DestroyImmediate(child.gameObject);
                }
            }

            Shader litShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            // 1. 묵직하고 깊은 진한 앤틱 황동(Aged Heavy Brass) 머티리얼 구성
            Material brassMainMat = new(litShader)
            {
                name = "Heavy Aged Brass Main Material",
                color = new Color(0.50f, 0.36f, 0.14f) // #805c24 (묵직하고 짙은 에이지드 황동)
            };
            brassMainMat.SetFloat("_Metallic", 0.85f);
            brassMainMat.SetFloat("_Smoothness", 0.48f);

            Material brassDarkRimMat = new(litShader)
            {
                name = "Heavy Aged Brass Rim Material",
                color = new Color(0.32f, 0.22f, 0.08f) // #523814 (깊고 어두운 앤틱 림)
            };
            brassDarkRimMat.SetFloat("_Metallic", 0.88f);
            brassDarkRimMat.SetFloat("_Smoothness", 0.52f);

            Material brassHighlightMat = new(litShader)
            {
                name = "Heavy Aged Brass Highlight Material",
                color = new Color(0.62f, 0.46f, 0.18f) // #9e752e (은은한 웜 앰버 하이라이트)
            };
            brassHighlightMat.SetFloat("_Metallic", 0.86f);
            brassHighlightMat.SetFloat("_Smoothness", 0.55f);

            // 2. 세로 길이를 2/3으로 줄이고 가로를 1.1배 확장한 직육면체 주괴(Brass Ingot Bar) 조형
            // 2-1. 하단 묵직한 베이스 바
            GameObject baseBar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseBar.name = "Ingot_BaseBar";
            SetupPart(baseBar, transform, new Vector3(0f, 0.10f, 0f), Vector3.zero, new Vector3(3.52f, 0.20f, 0.48f), brassDarkRimMat);

            // 2-2. 중앙 테이퍼드 메인 바
            GameObject mainBar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mainBar.name = "Ingot_MainBar";
            SetupPart(mainBar, transform, new Vector3(0f, 0.22f, 0f), Vector3.zero, new Vector3(3.25f, 0.16f, 0.38f), brassMainMat);

            // 2-3. 상단 챔퍼 톱 플레이트
            GameObject topPlate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            topPlate.name = "Ingot_TopPlate";
            SetupPart(topPlate, transform, new Vector3(0f, 0.31f, 0f), Vector3.zero, new Vector3(2.92f, 0.08f, 0.28f), brassHighlightMat);

            // 2-4. 중앙 길드 인장/다이아몬드 포인트
            GameObject emblem = GameObject.CreatePrimitive(PrimitiveType.Cube);
            emblem.name = "Ingot_Emblem";
            SetupPart(emblem, transform, new Vector3(0f, 0.35f, 0f), new Vector3(0f, 45f, 0f), new Vector3(0.20f, 0.04f, 0.20f), brassDarkRimMat);
        }

        private static void SetupPart(GameObject obj, Transform parent, Vector3 localPos, Vector3 localRot, Vector3 localScale, Material mat)
        {
            obj.layer = DecorationLayer;
            obj.transform.SetParent(parent, false);
            obj.transform.localPosition = localPos;
            obj.transform.localRotation = Quaternion.Euler(localRot);
            obj.transform.localScale = localScale;

            Collider col = obj.GetComponent<Collider>();
            if (col != null)
            {
                if (Application.isPlaying) Destroy(col);
                else DestroyImmediate(col);
            }

            MeshRenderer mr = obj.GetComponent<MeshRenderer>();
            if (mr != null)
            {
                mr.material = mat;
                mr.shadowCastingMode = ShadowCastingMode.TwoSided;
                mr.receiveShadows = true;
            }
        }
    }
}
