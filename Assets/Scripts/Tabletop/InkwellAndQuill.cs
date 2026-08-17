using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace Tessera.Tabletop
{
    /// <summary>
    /// 중세 여관/서재 테이블탑 우측 하단을 장식하는 3D 고광택 블랙 세라믹 잉크통과 깃펜 오브젝트
    /// </summary>
    public sealed class InkwellAndQuill : MonoBehaviour
    {
        private const int DecorationLayer = 11;

        public static InkwellAndQuill Create(Transform parent, Vector3 worldPosition, Quaternion? rotation = null, Vector3? scale = null)
        {
            GameObject root = new("3D Inkwell and Quill Decoration");
            root.layer = DecorationLayer;
            root.transform.SetParent(parent, false);
            root.transform.position = worldPosition;
            root.transform.rotation = rotation ?? Quaternion.identity;
            root.transform.localScale = scale ?? Vector3.one;

            InkwellAndQuill comp = root.AddComponent<InkwellAndQuill>();
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

            // 1. 머티리얼 구성
            // 검은색 잉크통에 조명 빛 반사로 원통 곡면의 모양감이 돋보이는 고광택 블랙 세라믹 머티리얼
            Material blackCeramicBodyMat = CreateMaterial("Black Ceramic Body Material", litShader, new Color(0.08f, 0.08f, 0.09f), 0.25f, 0.90f);
            Material blackCeramicRimMat = CreateMaterial("Black Ceramic Rim Material", litShader, new Color(0.05f, 0.05f, 0.06f), 0.35f, 0.92f);
            Material liquidInkMat = CreateMaterial("Liquid Ink Material", litShader, new Color(0.02f, 0.02f, 0.02f), 0.10f, 0.96f);
            Material goldTrimMat = CreateMaterial("Antique Gold Trim Material", litShader, new Color(0.78f, 0.58f, 0.22f), 0.75f, 0.65f);

            // 깃펜 머티리얼
            Material quillShaftMat = CreateMaterial("Quill Shaft Material", litShader, new Color(0.92f, 0.88f, 0.78f), 0.05f, 0.35f);
            Material quillFeatherMat = CreateMaterial("Quill Feather Material", litShader, new Color(0.98f, 0.95f, 0.88f), 0.02f, 0.18f);
            Material featherTipMat = CreateMaterial("Quill Feather Tip Material", litShader, new Color(0.85f, 0.72f, 0.52f), 0.05f, 0.22f);

            // 2. 원통형 블랙 잉크통 (Cylindrical Black Inkwell)
            GameObject inkwellGroup = new("Inkwell Body");
            inkwellGroup.layer = DecorationLayer;
            inkwellGroup.transform.SetParent(transform, false);

            // 2-1. 하단 받침대 (Base Rim)
            GameObject baseRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseRim.name = "Inkwell_BaseRim";
            SetupPart(baseRim, inkwellGroup.transform, new Vector3(0f, 0.08f, 0f), Vector3.zero, new Vector3(1.35f, 0.08f, 1.35f), blackCeramicRimMat);

            // 2-2. 중앙 원통형 메인 바디 (빛 반사 하이라이트가 맺히는 본체)
            GameObject mainBody = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mainBody.name = "Inkwell_MainBody";
            SetupPart(mainBody, inkwellGroup.transform, new Vector3(0f, 0.40f, 0f), Vector3.zero, new Vector3(1.05f, 0.28f, 1.05f), blackCeramicBodyMat);

            // 2-3. 입구 골드 림 액센트 링 (Antique Gold Ring)
            GameObject goldRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            goldRing.name = "Inkwell_GoldRing";
            SetupPart(goldRing, inkwellGroup.transform, new Vector3(0f, 0.68f, 0f), Vector3.zero, new Vector3(0.82f, 0.02f, 0.82f), goldTrimMat);

            // 2-4. 상단 병목 및 입구 림 (Neck Rim)
            GameObject neckRim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            neckRim.name = "Inkwell_NeckRim";
            SetupPart(neckRim, inkwellGroup.transform, new Vector3(0f, 0.74f, 0f), Vector3.zero, new Vector3(0.72f, 0.07f, 0.72f), blackCeramicRimMat);

            // 2-5. 입구 내부 액체 잉크 표면 (Liquid Ink Surface)
            GameObject inkSurface = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            inkSurface.name = "Inkwell_LiquidInk";
            SetupPart(inkSurface, inkwellGroup.transform, new Vector3(0f, 0.78f, 0f), Vector3.zero, new Vector3(0.56f, 0.01f, 0.56f), liquidInkMat);

            // 3. 2시 방향으로 기울어진 깃펜 (Feather Quill)
            GameObject quillRoot = new("Quill Pen Root");
            quillRoot.layer = DecorationLayer;
            quillRoot.transform.SetParent(transform, false);
            quillRoot.transform.localPosition = new Vector3(0f, 0.78f, 0f);

            // 사선 틸트: Pitch 42°, Yaw -65°, Roll 22°
            quillRoot.transform.localRotation = Quaternion.Euler(42f, -65f, 22f);

            // 3-1. 펜촉 (골든 닙)
            GameObject nib = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            nib.name = "Quill_Nib";
            SetupPart(nib, quillRoot.transform, new Vector3(0f, 0.15f, 0f), Vector3.zero, new Vector3(0.08f, 0.15f, 0.08f), goldTrimMat);

            // 3-2. 깃대 (Quill Shaft)
            GameObject shaft = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            shaft.name = "Quill_Shaft";
            SetupPart(shaft, quillRoot.transform, new Vector3(0f, 1.30f, 0f), Vector3.zero, new Vector3(0.045f, 1.15f, 0.045f), quillShaftMat);

            // 3-3. 풍성한 깃털 본체 (Quill Feather Main)
            GameObject featherMain = GameObject.CreatePrimitive(PrimitiveType.Cube);
            featherMain.name = "Quill_Feather_Main";
            SetupPart(featherMain, quillRoot.transform, new Vector3(0.02f, 1.60f, 0f), new Vector3(0f, 0f, -4f), new Vector3(0.46f, 1.45f, 0.025f), quillFeatherMat);

            // 3-4. 깃털 상단 팁 (앤틱 브라운 팁)
            GameObject featherTip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            featherTip.name = "Quill_Feather_Tip";
            SetupPart(featherTip, quillRoot.transform, new Vector3(0.05f, 2.38f, 0f), new Vector3(0f, 0f, -14f), new Vector3(0.26f, 0.45f, 0.020f), featherTipMat);

            // 3-5. 깃털 하단 솜털 (Feather Base Fluff)
            GameObject featherBase = GameObject.CreatePrimitive(PrimitiveType.Cube);
            featherBase.name = "Quill_Feather_Base";
            SetupPart(featherBase, quillRoot.transform, new Vector3(0f, 0.90f, 0f), new Vector3(0f, 0f, 10f), new Vector3(0.30f, 0.40f, 0.025f), quillFeatherMat);
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

        private static Material CreateMaterial(string name, Shader shader, Color color, float metallic, float smoothness)
        {
            Material mat = new(shader)
            {
                name = name,
                color = color
            };
            mat.SetFloat("_Metallic", metallic);
            mat.SetFloat("_Smoothness", smoothness);
            return mat;
        }
    }
}
