Shader "DicePoC/PixelUpscale"
{
    Properties
    {
        [PerRendererData] _MainTex ("Texture", 2D) = "white" {}
        _ColorSteps ("Color Steps", Range(2, 12)) = 6
        _Quantize ("Quantize", Float) = 0
        _VirtualResolution ("Virtual Resolution", Vector) = (640, 360, 0, 0)
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" "CanUseSpriteAtlas"="True" }
        Cull Off Lighting Off ZWrite Off ZTest Always
        Blend One Zero

        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);
            float4 _MainTex_ST;
            float _ColorSteps;
            float _Quantize;
            float2 _VirtualResolution;

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.uv = input.uv * _MainTex_ST.xy + _MainTex_ST.zw;
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float2 virtualResolution = max(_VirtualResolution, float2(1.0, 1.0));
                float2 pixelUV = (floor(saturate(input.uv) * virtualResolution) + 0.5) / virtualResolution;
                half4 color = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, pixelUV);
                if (_Quantize > 0.5)
                {
                    half steps = max(2.0h, (half)_ColorSteps);
                    color.rgb = floor(color.rgb * steps + 0.5h) / steps;
                }
                color.a = 1.0h;
                return color;
            }
            ENDHLSL
        }
    }
}
