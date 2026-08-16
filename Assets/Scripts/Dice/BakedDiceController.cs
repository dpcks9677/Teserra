using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Tessera.Core;

namespace Tessera.Dice
{
    public sealed class BakedDiceController : MonoBehaviour
    {
        private const float MotionThreshold = 0.001f;

        [Header("Audio")]
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private AudioClip[] rollSounds;
        [SerializeField] private AudioClip[] impactSounds;

        private static readonly Vector3[] FallbackDirections =
        {
            new(-0.85f, 0f, 0.45f),
            new(0.85f, 0f, 0.45f),
            new(-0.35f, 0f, 0.95f),
            new(0.35f, 0f, 0.95f),
            new(0f, 0f, 1f)
        };

        public void SetAudioSource(AudioSource source, AudioClip[] rolls, AudioClip[] impacts)
        {
            audioSource = source;
            rollSounds = rolls;
            impactSounds = impacts;
        }

        public IEnumerator Play(
            IReadOnlyList<Transform> dice,
            int presetIndex,
            WebPresetClip clip,
            IReadOnlyList<bool> preservedDice,
            IReadOnlyList<int> targetValues,
            bool isMirrored)
        {
            if (clip == null || clip.Frames == null || clip.Frames.Length == 0)
            {
                yield return PlayFallback(dice, presetIndex, preservedDice);
                ApplyTargetValues(dice, preservedDice, targetValues, null, isMirrored);
                yield break;
            }

            WebPresetFrame landingFrame = clip.Frames[clip.Frames.Length - 1];
            ApplyTargetValues(dice, preservedDice, targetValues, landingFrame, isMirrored);

            var origins = new Vector3[dice.Count];
            var rotations = new Quaternion[dice.Count];
            for (int index = 0; index < dice.Count; index++)
            {
                if (dice[index] != null)
                {
                    origins[index] = dice[index].localPosition;
                    rotations[index] = dice[index].localRotation;
                }
            }

            int completionFrameIndex = CalculatePresetCompletionFrame(clip);
            float duration = completionFrameIndex / (float)Mathf.Max(1, clip.Fps);
            float elapsed = 0f;
            int nextSoundIndex = 0;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;

                // 사운드 이벤트 처리
                if (clip.SoundEvents != null)
                {
                    while (nextSoundIndex < clip.SoundEvents.Length && elapsed >= clip.SoundEvents[nextSoundIndex].Time)
                    {
                        PlayPresetSound(clip.SoundEvents[nextSoundIndex]);
                        nextSoundIndex++;
                    }
                }

                float framePosition = Mathf.Clamp(elapsed * clip.Fps, 0f, Mathf.Max(0f, completionFrameIndex - 0.001f));
                int frameIndex = Mathf.FloorToInt(framePosition);
                int nextIndex = Mathf.Min(frameIndex + 1, clip.Frames.Length - 1);
                float blend = framePosition - frameIndex;

                WebPresetFrame frame = clip.Frames[frameIndex];
                WebPresetFrame nextFrame = clip.Frames[nextIndex];

                for (int dieIndex = 0; dieIndex < dice.Count; dieIndex++)
                {
                    if (dice[dieIndex] == null) continue;
                    if (preservedDice != null && dieIndex < preservedDice.Count && preservedDice[dieIndex]) continue;
                    if (dieIndex >= frame.Dice.Length || dieIndex >= nextFrame.Dice.Length) continue;

                    WebPresetDie current = TransformPresetDie(frame.Dice[dieIndex], isMirrored);
                    WebPresetDie next = TransformPresetDie(nextFrame.Dice[dieIndex], isMirrored);

                    dice[dieIndex].localPosition = Vector3.Lerp(current.Position, next.Position, blend);
                    dice[dieIndex].localRotation = Quaternion.Slerp(current.Rotation, next.Rotation, blend);
                }

                yield return null;
            }

            // 착지 프레임 값으로 최종 고정
            WebPresetFrame completionFrame = clip.Frames[completionFrameIndex];
            for (int index = 0; index < dice.Count; index++)
            {
                if (dice[index] == null) continue;
                if (preservedDice != null && index < preservedDice.Count && preservedDice[index]) continue;

                if (index < completionFrame.Dice.Length)
                {
                    WebPresetDie final = TransformPresetDie(completionFrame.Dice[index], isMirrored);
                    dice[index].localPosition = final.Position;
                    dice[index].localRotation = final.Rotation;
                }
                else
                {
                    dice[index].localPosition = origins[index];
                    dice[index].localRotation = rotations[index];
                }
            }
        }

        private IEnumerator PlayFallback(IReadOnlyList<Transform> dice, int presetIndex, IReadOnlyList<bool> preservedDice)
        {
            var origins = new Vector3[dice.Count];
            var rotations = new Quaternion[dice.Count];
            for (int index = 0; index < dice.Count; index++)
            {
                if (dice[index] != null)
                {
                    origins[index] = dice[index].localPosition;
                    rotations[index] = dice[index].localRotation;
                }
            }

            Vector3 direction = FallbackDirections[Mathf.Abs(presetIndex) % FallbackDirections.Length];
            const float duration = 0.85f;
            float elapsed = 0f;

            if (audioSource != null && rollSounds != null && rollSounds.Length > 0)
            {
                audioSource.PlayOneShot(rollSounds[UnityEngine.Random.Range(0, rollSounds.Length)], 0.5f);
            }

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float normalized = Mathf.Clamp01(elapsed / duration);
                float eased = Mathf.SmoothStep(0f, 1f, normalized);
                float arc = Mathf.Sin(normalized * Mathf.PI);

                for (int index = 0; index < dice.Count; index++)
                {
                    if (dice[index] == null) continue;
                    if (preservedDice != null && index < preservedDice.Count && preservedDice[index]) continue;

                    float phase = (index - (dice.Count - 1) * 0.5f) * 0.12f;
                    float localProgress = Mathf.Clamp01(normalized + phase);
                    Vector3 drift = direction * (Mathf.Sin(localProgress * Mathf.PI) * 0.8f);
                    Vector3 lift = Vector3.up * (arc * (0.8f + index * 0.05f));

                    dice[index].localPosition = origins[index] + drift + lift;
                    dice[index].localRotation = rotations[index] * Quaternion.Euler(
                        360f * eased * (1f + index * 0.13f),
                        270f * eased * (1f + presetIndex * 0.08f),
                        180f * eased);
                }

                yield return null;
            }

            for (int index = 0; index < dice.Count; index++)
            {
                if (dice[index] == null) continue;
                if (preservedDice != null && index < preservedDice.Count && preservedDice[index]) continue;

                dice[index].localPosition = origins[index];
                dice[index].localRotation = rotations[index];
            }
        }

        private void PlayPresetSound(WebPresetSoundEvent soundEvent)
        {
            if (audioSource == null) return;

            AudioClip clipToPlay = null;
            if (soundEvent.Type == "roll" && rollSounds != null && rollSounds.Length > 0)
            {
                clipToPlay = rollSounds[UnityEngine.Random.Range(0, rollSounds.Length)];
            }
            else if (impactSounds != null && impactSounds.Length > 0)
            {
                clipToPlay = impactSounds[UnityEngine.Random.Range(0, impactSounds.Length)];
            }

            if (clipToPlay != null)
            {
                audioSource.PlayOneShot(clipToPlay, soundEvent.Volume);
            }
        }

        private static void ApplyTargetValues(
            IReadOnlyList<Transform> dice,
            IReadOnlyList<bool> preservedDice,
            IReadOnlyList<int> targetValues,
            WebPresetFrame landingFrame,
            bool isMirrored)
        {
            if (targetValues == null) return;
            for (int index = 0; index < dice.Count && index < targetValues.Count; index++)
            {
                if (dice[index] == null) continue;
                if (preservedDice != null && index < preservedDice.Count && preservedDice[index]) continue;

                Quaternion landingRotation = landingFrame != null && index < landingFrame.Dice.Length
                    ? TransformPresetDie(landingFrame.Dice[index], isMirrored).Rotation
                    : dice[index].localRotation;

                Transform visual = dice[index].Find("Visual");
                if (visual != null)
                {
                    // FBX 3D 모델의 자체 기울기(333, 318, 0)를 측정하여 직교 기저로 보정하고 목표 눈으로 90도 회전
                    Quaternion baseCorrection = DiceFaceOrientation.MeasureModelBasis(visual);
                    visual.localRotation = DiceFaceOrientation.GetVisualRemapRotation(landingRotation, targetValues[index], baseCorrection);
                }
                else
                {
                    DiceMaterialFactory.ApplyPredictedTopValue(dice[index], landingRotation, targetValues[index]);
                }
            }
        }

        public static int CalculatePresetCompletionFrame(WebPresetClip clip)
        {
            if (clip?.Frames == null || clip.Frames.Length <= 1) return 0;

            int lastMovingFrame = 0;
            for (int frameIndex = 1; frameIndex < clip.Frames.Length; frameIndex++)
            {
                if (HasMotion(clip.Frames[frameIndex - 1], clip.Frames[frameIndex]))
                {
                    lastMovingFrame = frameIndex;
                }
            }

            return Mathf.Min(clip.Frames.Length - 1, lastMovingFrame + 1);
        }

        private static bool HasMotion(WebPresetFrame previous, WebPresetFrame current)
        {
            if (previous?.Dice == null || current?.Dice == null) return false;
            int diceCount = Mathf.Min(previous.Dice.Length, current.Dice.Length);
            for (int index = 0; index < diceCount; index++)
            {
                WebPresetDie left = previous.Dice[index];
                WebPresetDie right = current.Dice[index];
                if (Mathf.Abs(left.Position.x - right.Position.x) > MotionThreshold ||
                    Mathf.Abs(left.Position.y - right.Position.y) > MotionThreshold ||
                    Mathf.Abs(left.Position.z - right.Position.z) > MotionThreshold ||
                    Mathf.Abs(left.Rotation.x - right.Rotation.x) > MotionThreshold ||
                    Mathf.Abs(left.Rotation.y - right.Rotation.y) > MotionThreshold ||
                    Mathf.Abs(left.Rotation.z - right.Rotation.z) > MotionThreshold ||
                    Mathf.Abs(left.Rotation.w - right.Rotation.w) > MotionThreshold)
                {
                    return true;
                }
            }
            return false;
        }

        public static WebPresetDie TransformPresetDie(WebPresetDie die, bool isMirrored)
        {
            Vector3 scaledPos = DiceBoardMetrics.TransformPresetPosition(die.Position, isMirrored);

            Quaternion rot = die.Rotation;
            if (isMirrored)
            {
                rot = new Quaternion(rot.x, -rot.y, -rot.z, rot.w);
            }

            // 6시 -> 12시 투척 변환에 맞추어 주사위 자세도 Y축 180도 회전
            rot = Quaternion.Euler(0f, 180f, 0f) * rot;

            return new WebPresetDie(scaledPos, rot);
        }

        /// <summary>
        /// 킵(Keep) 상태가 변경되었을 때 킵된 주사위들을 킵 슬롯으로 부드럽게 이동/정렬
        /// </summary>
        public IEnumerator AnimateKeptDice(
            IReadOnlyList<Transform> dice,
            IReadOnlyList<bool> keptDice,
            IReadOnlyList<int> diceValues,
            IReadOnlyList<Vector3> targetPositions,
            IReadOnlyList<Quaternion> targetRotations,
            IReadOnlyList<Vector3> targetScales,
            float duration = 0.25f)
        {
            if (dice == null || dice.Count == 0) yield break;

            int count = dice.Count;
            var startPositions = new Vector3[count];
            var startRotations = new Quaternion[count];
            var startScales = new Vector3[count];

            for (int i = 0; i < count; i++)
            {
                if (dice[i] == null) continue;
                startPositions[i] = dice[i].localPosition;
                startRotations[i] = dice[i].localRotation;
                startScales[i] = dice[i].localScale;
            }

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float progress = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(elapsed / duration));

                for (int i = 0; i < count; i++)
                {
                    if (dice[i] == null) continue;
                    dice[i].localPosition = Vector3.Lerp(startPositions[i], targetPositions[i], progress);
                    dice[i].localRotation = Quaternion.Slerp(startRotations[i], targetRotations[i], progress);
                    dice[i].localScale = Vector3.Lerp(startScales[i], targetScales[i], progress);
                }

                yield return null;
            }

            for (int i = 0; i < count; i++)
            {
                if (dice[i] == null) continue;
                dice[i].localPosition = targetPositions[i];
                dice[i].localRotation = targetRotations[i];
                dice[i].localScale = targetScales[i];
            }
        }
    }
}
