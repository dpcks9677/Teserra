Shader "DicePoC/OrbHearthstoneAura"
{
    Properties
    {
        _AuraColor ("Aura Flame Color", Color) = (0.12, 0.50, 0.90, 0.85)
        _CoreColor ("Core Filament Color", Color) = (0.45, 0.88, 1.00, 1.00)
        _InnerRadius ("Inner Mask Radius", Range(0.3, 0.9)) = 0.675
        _OuterRadius ("Outer Flame Radius", Range(0.6, 1.4)) = 0.950
        _FlowSpeed ("Swirling Flow Speed", Range(0.2, 5.0)) = 1.6
        _FlameTurbulence ("Turbulence Strength", Range(0.1, 2.0)) = 0.85
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
        Blend SrcAlpha One // Additive Mana Flame

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
                float  _OuterRadius;
                float  _FlowSpeed;
                float  _FlameTurbulence;
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
                float theta = atan2(uvOffset.y, uvOffset.x);
                float t = _Time.y * _FlowSpeed;

                // 하스스톤 스타일 극좌표 회전/일렁임 불꽃 노이즈 합성
                float w1 = sin(theta * 6.0 + t * 2.8 + r * 8.0) * 0.038 * _FlameTurbulence;
                float w2 = cos(theta * 10.0 - t * 1.9 - r * 6.0) * 0.026 * _FlameTurbulence;
                float w3 = sin(t * 4.5 + theta * 16.0) * 0.014 * _FlameTurbulence;
                float rDistort = r + w1 + w2 + w3;

                // 1. 안쪽 밀착 마스킹 (구체 내부 투명도 보존)
                float innerMask = smoothstep(_InnerRadius - 0.015, _InnerRadius + 0.025, rDistort);

                // 2. 바깥쪽 불꽃 텐드릴 감쇄 (Organic Flame Dissolve)
                float flameFade = saturate((_OuterRadius - rDistort) / max(0.001, (_OuterRadius - _InnerRadius)));
                float flameAlpha = pow(flameFade, 1.8) * innerMask;

                // 3. 밝은 마나 코어 필라멘트 핫스팟 (Inner Filament Line)
                float coreDist = abs(rDistort - (_InnerRadius + 0.025));
                float coreLine = exp(-pow(coreDist / 0.035, 2.0)) * 1.35 * innerMask;

                // 4. 불꽃 팁 미세 일렁임 하이라이트 (Flame Tongue Highlights)
                float tongue = pow(saturate(sin(theta * 8.0 + t * 3.2) * 0.5 + 0.5), 3.0) * flameAlpha * 0.5;

                // 5. 톤온톤 컬러 합성
                half3 finalRGB = lerp(_AuraColor.rgb, _CoreColor.rgb, saturate(coreLine * 0.85 + tongue * 0.4));
                float totalAlpha = (flameAlpha * 0.75 + coreLine * 0.95 + tongue * 0.3) * _Intensity * _AuraColor.a;

                return half4(finalRGB * totalAlpha, totalAlpha);
            }
            ENDHLSL
        }
    }
    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
