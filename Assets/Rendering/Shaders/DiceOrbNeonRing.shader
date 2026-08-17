Shader "DicePoC/OrbNeonRing"
{
    Properties
    {
        _NeonColor ("Tone-on-Tone Neon Color", Color) = (0.20, 0.62, 0.92, 0.85)
        _BorderColor ("Crisp Border Highlight", Color) = (0.45, 0.85, 1.00, 1.0)
        _InnerRadius ("Inner Border Radius", Range(0.3, 0.9)) = 0.64
        _OuterRadius ("Outer Border Radius", Range(0.5, 1.2)) = 0.84
        _BorderWidth ("Border Line Thickness", Range(0.005, 0.1)) = 0.025
        _Intensity ("Neon Intensity", Range(0.0, 2.0)) = 0.0
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
        Blend SrcAlpha One // Additive Tone-on-tone Glow

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
                float4 _NeonColor;
                float4 _BorderColor;
                float  _InnerRadius;
                float  _OuterRadius;
                float  _BorderWidth;
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

                // 1. 선명하고 명확한 안쪽/바깥쪽 테두리 스텝 마스크 (Crisp Edge Cut)
                float innerStep = smoothstep(_InnerRadius - 0.015, _InnerRadius + 0.015, r);
                float outerStep = 1.0 - smoothstep(_OuterRadius - 0.015, _OuterRadius + 0.015, r);
                float ringMask = innerStep * outerStep;

                // 2. 안쪽과 바깥쪽 경계선 테두리 강조선 (Crisp Border Lines)
                float innerBorder = exp(-pow((r - _InnerRadius) / max(0.001, _BorderWidth), 2.0));
                float outerBorder = exp(-pow((r - _OuterRadius) / max(0.001, _BorderWidth), 2.0));
                float borders = saturate(innerBorder + outerBorder);

                // 3. 링 내부 중심부의 차분한 톤온톤 채움 (Tone-on-tone Core Fill)
                float midR = (_InnerRadius + _OuterRadius) * 0.5;
                float halfWidth = (_OuterRadius - _InnerRadius) * 0.5;
                float coreFill = 1.0 - saturate(abs(r - midR) / max(0.001, halfWidth));
                coreFill = pow(coreFill, 0.7) * 0.65;

                // 4. 최종 합성: 톤온톤 바디 + 명확한 테두리 스트로크
                half3 ringRGB = lerp(_NeonColor.rgb, _BorderColor.rgb, borders * 0.75);
                float finalAlpha = saturate(coreFill + borders * 0.85) * ringMask * _Intensity * _NeonColor.a;

                return half4(ringRGB * finalAlpha, finalAlpha);
            }
            ENDHLSL
        }
    }
    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
