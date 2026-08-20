Shader "DicePoC/OrbCaustics"
{
    Properties
    {
        _BaseColor ("Ocean Sapphire Color", Color) = (0.04, 0.16, 0.38, 0.98)
        _ShadowColor ("Deep Shadow Color", Color) = (0.015, 0.06, 0.15, 1.0)
        _CausticColor ("Deep Sapphire Wave", Color) = (0.11, 0.50, 0.76, 1.0)
        _CausticIntensity ("Wave Intensity", Range(0.0, 4.0)) = 1.35
        _WaveSpeed ("Wave Animation Speed", Range(0.05, 2.5)) = 0.65
        _WaveScale ("Wave Scale", Range(0.3, 3.0)) = 0.95
        _WaveDistortion ("Wave Warp", Range(0.1, 2.0)) = 0.75
        _RimColor ("Rim Halo Color", Color) = (0.12, 0.45, 0.72, 1.0)
        _RimPower ("Rim Power", Range(0.5, 6.0)) = 3.0
        _RimIntensity ("Rim Intensity", Range(0.2, 4.0)) = 0.65
    }

    SubShader
    {
        Tags 
        { 
            "RenderType"="Opaque" 
            "Queue"="Geometry" 
            "RenderPipeline"="UniversalPipeline" 
            "IgnoreProjector"="True" 
        }

        LOD 200
        Cull Back
        ZWrite On

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile _ _ADDITIONAL_LIGHTS

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float2 uv         : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS   : TEXCOORD1;
                float3 positionOS : TEXCOORD2;
                float2 uv         : TEXCOORD3;
            };

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseColor;
                float4 _ShadowColor;
                float4 _CausticColor;
                float  _CausticIntensity;
                float  _WaveSpeed;
                float  _WaveScale;
                float  _WaveDistortion;
                float4 _RimColor;
                float  _RimPower;
                float  _RimIntensity;
            CBUFFER_END

            // 실크 오로라 베일 리본 (WaveSpeed: 0.65)
            float EvaluateSmoothWaveRibbons(float3 posWS, float3 normalWS)
            {
                float t = _Time.y * _WaveSpeed;
                float3 p = posWS * _WaveScale;

                // 1번 메인 오로라
                float w1 = sin(p.x * 1.3 + sin(p.y * 1.0 + t * 0.7) * _WaveDistortion + p.z * 0.8 + t * 0.5);
                float ribbon1 = exp(-pow(w1 * 2.0, 2.0));

                // 2번 교차 보조 오로라
                float w2 = cos(p.z * 1.4 + cos(p.x * 0.8 - t * 0.6) * _WaveDistortion + p.y * 1.1 - t * 0.4);
                float ribbon2 = exp(-pow(w2 * 2.35, 2.0)) * 0.8;

                float totalWave = saturate(ribbon1 * 0.95 + ribbon2 * 0.80);
                return pow(totalWave, 1.25);
            }

            Varyings vert(Attributes input)
            {
                Varyings output;
                VertexPositionInputs vertexInput = GetVertexPositionInputs(input.positionOS.xyz);
                VertexNormalInputs normalInput = GetVertexNormalInputs(input.normalOS);

                output.positionCS = vertexInput.positionCS;
                output.positionWS = vertexInput.positionWS;
                output.normalWS   = normalInput.normalWS;
                output.positionOS = input.positionOS.xyz;
                output.uv         = input.uv;
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float3 normalWS = normalize(input.normalWS);
                float3 viewDirWS = normalize(GetCameraPositionWS() - input.positionWS);

                // 1. 깊고 묵직한 딥 사파이어 크리스탈 덩어리감 (하단 Deep Midnight ~ 상단 Ocean Sapphire)
                float heightGrad = saturate(normalWS.y * 0.55 + 0.45);
                float sphereDepth = saturate(dot(normalWS, viewDirWS));
                half3 bodyColor = lerp(_ShadowColor.rgb, _BaseColor.rgb, heightGrad * (0.35 + 0.65 * sphereDepth));

                // 2. 실시간 오로라 물결 리본
                float waveMask = EvaluateSmoothWaveRibbons(input.positionWS, normalWS);
                half3 waveGlow = _CausticColor.rgb * (waveMask * _CausticIntensity);

                // 3. 본체와 어우러지는 톤온톤 딥 사파이어 외곽 림
                float fresnel = 1.0 - sphereDepth;
                float rimTerm = pow(fresnel, _RimPower);
                half3 rimGlow = _RimColor.rgb * (rimTerm * _RimIntensity);

                // 4. 주 광원 라이팅 (스페큘러 반사점 제거, 부드러운 디퓨즈 조명만 유지)
                Light mainLight = GetMainLight();
                float3 lightDir = normalize(mainLight.direction);
                float NdotL = saturate(dot(normalWS, lightDir));
                
                half3 coolLight = lerp(mainLight.color, half3(0.60, 0.80, 0.98), 0.80);
                half3 diffuse = bodyColor * (coolLight * (0.40 + 0.60 * NdotL));

                // 5. 최종 합성: 스페큘러 반사점 없는 매끄럽고 맑은 크리스탈 표면
                half3 finalRGB = diffuse + waveGlow + rimGlow;
                return half4(finalRGB, 1.0);
            }
            ENDHLSL
        }
    }
    FallBack "Universal Render Pipeline/Lit"
}
