Shader "DicePoC/OrbOuterGlow"
{
    Properties
    {
        _GlowColor ("Outer Glow Color", Color) = (0.12, 0.55, 0.95, 1.0)
        _InnerRadius ("Inner Mask Radius", Range(0.0, 1.0)) = 0.67
        _OuterRadius ("Outer Edge Radius", Range(0.5, 1.5)) = 0.98
        _FalloffPower ("Falloff Curve Power", Range(0.5, 8.0)) = 2.2
        _Intensity ("Glow Intensity", Range(0.0, 3.0)) = 0.60
        _ShimmerIntensity ("Ethereal Shimmer", Range(0.0, 1.0)) = 0.12
    }

    SubShader
    {
        Tags 
        { 
            "RenderType"="Transparent" 
            "Queue"="Transparent+50" 
            "RenderPipeline"="UniversalPipeline" 
            "IgnoreProjector"="True" 
        }

        LOD 100
        Cull Off
        ZWrite Off
        ZTest LEqual
        Blend SrcAlpha One // Additive Glowing

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
                float4 _GlowColor;
                float  _InnerRadius;
                float  _OuterRadius;
                float  _FalloffPower;
                float  _Intensity;
                float  _ShimmerIntensity;
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

                // 미세한 유기적 마법 일렁임 (Ethereal Shimmer)
                float angle = atan2(uvOffset.y, uvOffset.x);
                float wave = sin(_Time.y * 2.8 + angle * 3.0) * 0.05 * _ShimmerIntensity;
                float dist = r - wave;

                // 1. 내부 마스킹 (수정구 본체 내부에는 침범하지 않음)
                float innerMask = smoothstep(_InnerRadius, _InnerRadius + 0.08, dist);

                // 2. 외곽 방사형 감쇄 (Soft Gaussian/Exponential Falloff)
                float outerFactor = saturate((_OuterRadius - dist) / max(0.001, (_OuterRadius - _InnerRadius)));
                float haloAlpha = pow(outerFactor, _FalloffPower) * innerMask * _Intensity;

                half3 glowRGB = _GlowColor.rgb * haloAlpha;
                return half4(glowRGB, haloAlpha);
            }
            ENDHLSL
        }
    }
    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
