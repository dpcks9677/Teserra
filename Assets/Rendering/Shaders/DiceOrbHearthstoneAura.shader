Shader "DicePoC/OrbHearthstoneAura"
{
    Properties
    {
        _AuraColor ("Aura Base Color", Color) = (0.12, 0.50, 0.90, 0.90)
        _CoreColor ("Core Border Highlight Color", Color) = (0.45, 0.88, 1.00, 1.00)
        _InnerRadius ("Inner Mask Radius", Range(0.3, 0.9)) = 0.58
        _BorderWidth ("Core Border Width", Range(0.02, 0.3)) = 0.12
        _OuterRadius ("Outer Glow Radius", Range(0.6, 1.0)) = 0.98
        _FalloffPower ("Glow Falloff Power", Range(1.0, 5.0)) = 1.8
        _Intensity ("Aura Intensity", Range(0.0, 3.0)) = 0.0
    }

    SubShader
    {
        Tags 
        { 
            "RenderType"="Transparent" 
            "Queue"="Transparent+60" 
            "RenderPipeline"="UniversalPipeline" 
            "IgnoreProjector"="True" 
        }

        LOD 100
        Cull Off
        ZWrite Off
        ZTest LEqual
        Blend SrcAlpha One // Additive Glowing Border

        Pass
        {
            Name "ForwardUnlit"
            Tags { "LightMode"="UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv         : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv         : TEXCOORD0;
            };

            CBUFFER_START(UnityPerMaterial)
                float4 _AuraColor;
                float4 _CoreColor;
                float  _InnerRadius;
                float  _BorderWidth;
                float  _OuterRadius;
                float  _FalloffPower;
                float  _Intensity;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                VertexPositionInputs vertexInput = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = vertexInput.positionCS;
                output.uv         = input.uv;
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                // 중심 기준 정규화된 2D 벡터 (-1.0 ~ 1.0)
                float2 uvOffset = (input.uv - 0.5) * 2.0;
                float r = length(uvOffset);

                // 1. 안쪽 시작점 밀착 마스킹 (구체 바로 바깥에서 선명하게 시작)
                float innerEdge = smoothstep(_InnerRadius - 0.015, _InnerRadius + 0.015, r);

                // 2. 바깥쪽 상대 거리 (0.0: 수정구 경계 ~ 1.0: 테두리 끝단)
                float span = max(0.001, _OuterRadius - _InnerRadius);
                float normDist = saturate((r - _InnerRadius) / span);

                // 3. 끝으로 갈수록 은은하게 빠지는 부드러운 감쇄 (Soft Feathered Falloff)
                // 3-1. 부드러운 끝단 0 수렴 커브 (Cubic Smoothstep)
                float featherCurve = smoothstep(1.0, 0.0, normDist);
                // 3-2. 중심부 광량 집중 및 외곽 지수 감쇄 (Exponential Decay)
                float expFalloff = exp(-normDist * 2.2);
                float glowProfile = featherCurve * expFalloff * innerEdge;

                // 4. 선명한 안쪽 코어 림 라인 (Inner Vivid Core)
                float coreLine = exp(-pow(normDist / 0.18, 2.0)) * innerEdge;

                // 5. 톤온톤 그라데이션: 안쪽(밝은 코어) -> 바깥쪽(딥 사파이어) -> 은은하게 페이드아웃
                float colorMix = saturate(coreLine * 0.85 + (1.0 - normDist) * 0.40);
                half3 finalRGB = lerp(_AuraColor.rgb, _CoreColor.rgb, colorMix);

                // 총 투명도: 코어의 또렷한 빛 + 외곽으로 부드럽게 은은히 빠지는 테두리
                float totalAlpha = (glowProfile * 1.15 + coreLine * 0.95) * _Intensity * _AuraColor.a;

                return half4(finalRGB * totalAlpha, totalAlpha);
            }
            ENDHLSL
        }
    }
    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
