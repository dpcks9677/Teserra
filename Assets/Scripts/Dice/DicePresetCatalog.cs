using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Tessera.Dice
{
    public sealed class DicePresetCatalog
    {
        private const string DefaultPresetFile = "dice_presets_normal_5.json";
        private readonly Dictionary<string, List<WebPresetClip>> clipsByFile = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> indexedDiceCounts = new(StringComparer.OrdinalIgnoreCase);

        public bool IsLoaded { get; private set; }
        public string LastError { get; private set; }
        public int NormalFiveDiceClipCount => GetClipCount(DefaultPresetFile);

        public static DicePresetCatalog LoadNormalFiveDice()
        {
            var catalog = new DicePresetCatalog();
            catalog.LoadFile(DefaultPresetFile, 5);
            return catalog;
        }

        public static DicePresetCatalog LoadAll()
        {
            var catalog = new DicePresetCatalog();
            catalog.LoadIndex();
            return catalog;
        }

        public bool TryGetClip(int index, out WebPresetClip clip)
        {
            return TryGetClip(DefaultPresetFile, index, out clip);
        }

        public bool TryGetClip(string fileName, int index, out WebPresetClip clip)
        {
            clip = null;
            if (string.IsNullOrWhiteSpace(fileName)) return false;
            if (!clipsByFile.ContainsKey(fileName) && indexedDiceCounts.TryGetValue(fileName, out var expectedDiceCount))
            {
                LoadFile(fileName, expectedDiceCount);
            }
            if (!clipsByFile.TryGetValue(fileName, out var clips) || clips.Count == 0) return false;
            int normalizedIndex = (index % clips.Count + clips.Count) % clips.Count;
            clip = clips[normalizedIndex];
            return true;
        }

        public int GetClipCount(string fileName)
        {
            if (fileName != null && !clipsByFile.ContainsKey(fileName) && indexedDiceCounts.TryGetValue(fileName, out var expectedDiceCount))
            {
                LoadFile(fileName, expectedDiceCount);
            }
            return fileName != null && clipsByFile.TryGetValue(fileName, out var clips) ? clips.Count : 0;
        }

        private void LoadIndex()
        {
            string path = Path.Combine(Application.streamingAssetsPath, "WebSource", "presets", "index.json");
            if (!File.Exists(path))
            {
                AppendError($"Web preset index missing: {path}");
                return;
            }

            try
            {
                var entries = JArray.Parse(File.ReadAllText(path));
                foreach (var token in entries)
                {
                    if (token is not JObject entry) throw new FormatException("Web preset index entry must be an object.");
                    string fileName = (string)entry["file"];
                    int? diceCount = (int?)entry["diceCount"];
                    if (!diceCount.HasValue || diceCount.Value <= 0) continue;
                    if (!string.IsNullOrWhiteSpace(fileName)) indexedDiceCounts[fileName] = diceCount.Value;
                }
            }
            catch (Exception exception)
            {
                AppendError($"Web preset index parse failed: {exception.Message}");
            }

            IsLoaded = indexedDiceCounts.Count > 0;
        }

        private void LoadFile(string fileName, int? expectedDiceCount)
        {
            string path = Path.Combine(Application.streamingAssetsPath, "WebSource", "presets", fileName);
            if (!File.Exists(path))
            {
                AppendError($"Web preset missing: {path}");
                return;
            }

            try
            {
                var root = JArray.Parse(File.ReadAllText(path));
                if (root.Count == 0) throw new FormatException("Preset list is empty.");
                var clips = new List<WebPresetClip>(root.Count);
                foreach (var token in root)
                {
                    if (token is not JObject source) throw new FormatException("Preset entry must be an object.");
                    var clip = WebPresetClip.Parse(source);
                    clips.Add(clip);
                }

                clipsByFile[fileName] = clips;
                IsLoaded = clipsByFile.Count > 0;
            }
            catch (Exception exception)
            {
                AppendError($"Web preset parse failed ({fileName}): {exception.Message}");
            }
        }

        private void AppendError(string message)
        {
            LastError = string.IsNullOrEmpty(LastError) ? message : $"{LastError}\n{message}";
        }
    }

    public sealed class WebPresetClip
    {
        public readonly string Mode;
        public readonly int DiceCount;
        public readonly float Score;
        public readonly int Fps;
        public readonly WebPresetFrame[] Frames;
        public readonly WebPresetSoundEvent[] SoundEvents;
        public int FrameCount => Frames.Length;

        public WebPresetClip(string mode, int diceCount, float score, int fps, WebPresetFrame[] frames, WebPresetSoundEvent[] soundEvents)
        {
            Mode = mode;
            DiceCount = diceCount;
            Score = score;
            Fps = Mathf.Max(1, fps);
            Frames = frames;
            SoundEvents = soundEvents ?? Array.Empty<WebPresetSoundEvent>();
        }

        public static WebPresetClip Parse(JObject source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (source["frames"] is not JArray frameTokens || frameTokens.Count == 0)
            {
                throw new FormatException("Preset frames are missing or empty.");
            }

            var frames = new WebPresetFrame[frameTokens.Count];
            int? diceCount = (int?)source["diceCount"];
            for (int frameIndex = 0; frameIndex < frameTokens.Count; frameIndex++)
            {
                if (frameTokens[frameIndex] is not JArray diceTokens || diceTokens.Count == 0)
                {
                    throw new FormatException($"Preset frame {frameIndex} is missing dice.");
                }
                if (!diceCount.HasValue) diceCount = diceTokens.Count;

                var dice = new WebPresetDie[diceTokens.Count];
                for (int dieIndex = 0; dieIndex < diceTokens.Count; dieIndex++)
                {
                    if (diceTokens[dieIndex] is not JArray values || values.Count < 7)
                    {
                        throw new FormatException($"Preset frame {frameIndex}, die {dieIndex} is incomplete.");
                    }

                    dice[dieIndex] = new WebPresetDie(
                        new Vector3((float)values[0], (float)values[1], (float)values[2]),
                        new Quaternion((float)values[3], (float)values[4], (float)values[5], (float)values[6]));
                }

                frames[frameIndex] = new WebPresetFrame(dice);
            }

            WebPresetSoundEvent[] soundEvents = null;
            if (source["soundEvents"] is JArray soundTokens && soundTokens.Count > 0)
            {
                soundEvents = new WebPresetSoundEvent[soundTokens.Count];
                for (int i = 0; i < soundTokens.Count; i++)
                {
                    if (soundTokens[i] is JObject soundObj)
                    {
                        soundEvents[i] = new WebPresetSoundEvent(
                            (float?)soundObj["time"] ?? 0f,
                            (string)soundObj["type"] ?? "impact",
                            (float?)soundObj["volume"] ?? 0.5f,
                            (float?)soundObj["startOffset"] ?? 0f);
                    }
                }
            }

            return new WebPresetClip(
                (string)source["mode"] ?? "normal",
                diceCount ?? 5,
                (float?)source["score"] ?? 0f,
                (int?)source["fps"] ?? 20,
                frames,
                soundEvents);
        }
    }

    public sealed class WebPresetFrame
    {
        public readonly WebPresetDie[] Dice;

        public WebPresetFrame(WebPresetDie[] dice)
        {
            Dice = dice ?? Array.Empty<WebPresetDie>();
        }
    }

    public readonly struct WebPresetDie
    {
        public readonly Vector3 Position;
        public readonly Quaternion Rotation;

        public WebPresetDie(Vector3 position, Quaternion rotation)
        {
            Position = position;
            Rotation = rotation;
        }
    }

    public readonly struct WebPresetSoundEvent
    {
        public readonly float Time;
        public readonly string Type;
        public readonly float Volume;
        public readonly float StartOffset;

        public WebPresetSoundEvent(float time, string type, float volume, float startOffset)
        {
            Time = time;
            Type = type;
            Volume = volume;
            StartOffset = startOffset;
        }
    }
}
