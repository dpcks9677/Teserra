Shader "DicePoC/OrbConstellation"
{
    Properties
    {
        _ConstellationColor ("Constellation Soft White", Color) = (0.92, 0.96, 1.00, 0.70)
        _CurrentTex ("Current Constellation", 2D) = "black" {}
        _NextTex ("Next Constellation", 2D) = "black" {}
        _Transition ("Transition Progress", Range(0.0, 1.0)) = 0.0
        _Intensity ("Glow Intensity", Range(0.0, 4.0)) = 1.15
        _TwinkleSpeed ("Twinkle Speed", Range(0.5, 6.0)) = 2.2
        _TwinkleAmount ("Twinkle Amount", Range(0.0, 1.0)) = 0.55
        _FloatDrift ("Float Drift Amount", Range(0.0, 0.08)) = 0.012
        _WarpSpeed ("Wave Warp Speed", Range(0.1, 3.0)) = 0.75
        _WarpScale ("Wave Warp Scale", Range(0.5, 6.0)) = 2.2
        _WarpDistortion ("Wave Warp Distortion", Range(0.0, 0.05)) = 0.010
        _SphereRadius ("Circle Mask Radius", Range(0.3, 1.0)) = 0.78
        _MaskFalloff ("Circle Mask Falloff", Range(0.01, 0.3)) = 0.06
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
        ZTest Always
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

            sampler2D _CurrentTex;
            sampler2D _NextTex;

            CBUFFER_START(UnityPerMaterial)
                float4 _ConstellationColor;
                float  _Transition;
                float  _Intensity;
                float  _TwinkleSpeed;
                float  _TwinkleAmount;
                float  _FloatDrift;
                float  _WarpSpeed;
                float  _WarpScale;
                float  _WarpDistortion;
                float  _SphereRadius;
                float  _MaskFalloff;
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
                float t = _Time.y;

                // 1. 전경 별자리 유기적 부유 및 파동 왜곡
                float2 fgDrift = float2(
                    sin(t * 0.75 + input.uv.y * 1.5),
                    cos(t * 0.60 + input.uv.x * 1.5)
                ) * _FloatDrift;

                float2 fgDriftedUV = input.uv + fgDrift;
                float warpTime = t * _WarpSpeed;
                float2 wave = float2(
                    sin(fgDriftedUV.y * _WarpScale * 3.14159 + warpTime) * _WarpDistortion,
                    cos(fgDriftedUV.x * _WarpScale * 3.14159 - warpTime * 0.85) * _WarpDistortion
                );
                float2 sampleUV = fgDriftedUV + wave;

                // 2. 텍스처 샘플링 및 크로스페이드 트랜지션
                half4 curTex = tex2D(_CurrentTex, sampleUV);
                half4 nextTex = tex2D(_NextTex, sampleUV);
                half4 mixed = lerp(curTex, nextTex, saturate(_Transition));

                // 3. 주요 별 코어 개별 트윙클 펄스 (Star Point Twinkle)
                float tw1 = sin(t * _TwinkleSpeed + sampleUV.x * 14.0) * 0.5 + 0.5;
                float tw2 = cos(t * (_TwinkleSpeed * 1.38) - sampleUV.y * 16.0) * 0.5 + 0.5;
                float twinkle = lerp(0.65, 1.45, tw1 * tw2);

                // 4. 배경 은하수 성운 & 미세 별가루 다단계 반짝임 (Background Stardust Twinkle)
                float twDust1 = sin(t * 1.6 + sampleUV.x * 22.0 + sampleUV.y * 16.0) * 0.5 + 0.5;
                float twDust2 = cos(t * 2.1 - sampleUV.y * 20.0 + sampleUV.x * 14.0) * 0.5 + 0.5;
                float stardustTwinkle = lerp(0.70, 1.30, twDust1 * twDust2);

                // 5. 레이어별 밸런싱
                // R: 선 및 별 헤일로
                // G: 별 코어 및 다이아몬드 스파이크
                // B: 은하수 성운 띠 + 80개 미세 별가루 (1.05 선명한 은하수)
                float lineGlow = mixed.r * 0.95;
                float starCore = mixed.g * lerp(1.0, twinkle, _TwinkleAmount) * 1.65;
                float stardustGlow = mixed.b * stardustTwinkle * 1.05;

                float totalShape = lineGlow + starCore + stardustGlow;

                // 6. 수정구 원형 마스킹 (Sphere Circle Mask Falloff)
                float2 centerOffset = (input.uv - 0.5) * 2.0;
                float dist = length(centerOffset);
                float circleMask = 1.0 - smoothstep(_SphereRadius - _MaskFalloff, _SphereRadius + _MaskFalloff, dist);

                // 7. 최종 컬러 합성: 은은하고 맑은 백색/은빛 소프트 글로우
                half3 rgb = _ConstellationColor.rgb * totalShape * _Intensity;
                float alpha = saturate((lineGlow * 1.0 + starCore * 1.3 + stardustGlow * 0.95) * _ConstellationColor.a * circleMask * _Intensity);

                // Blend SrcAlpha One: src.rgb * src.a + dst.rgb
                return half4(rgb, alpha);
            }
            ENDHLSL
        }
    }
    FallBack "Universal Render Pipeline/Unlit"
}
