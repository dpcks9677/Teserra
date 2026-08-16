using System.Collections;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Tessera.Games.AugmentedYacht;

[InitializeOnLoad]
public static class RunDicePhysicsValidation
{
    private const string ScenePath = "Assets/Scenes/Augmented Dice.unity";
    private const string ValidationRequestedKey = "Tessera.PhysicsKeepValidationRequested";
    private const string ValidationRunningKey = "Tessera.PhysicsKeepValidationRunning";

    private static int phase;
    private static double phaseStartedAt;
    private static int firstKeptValue;
    private static int secondKeptValue;

    static RunDicePhysicsValidation()
    {
        EditorApplication.playModeStateChanged -= OnPlayModeStateChanged;
        EditorApplication.playModeStateChanged += OnPlayModeStateChanged;
        EditorApplication.update -= TryStartValidation;
        EditorApplication.update += TryStartValidation;
    }

    [MenuItem("Tools/Tessera/Run Physics And Keep Validation")]
    public static void Run()
    {
        if (EditorApplication.isPlaying)
        {
            Debug.LogWarning("Please exit play mode first.");
            return;
        }

        SessionState.SetBool(ValidationRequestedKey, true);
        SessionState.SetBool(ValidationRunningKey, false);
        EnsureSceneLoaded();
        EditorApplication.isPlaying = true;
    }

    private static void EnsureSceneLoaded()
    {
        var activeScene = EditorSceneManager.GetActiveScene();
        if (activeScene.path != ScenePath)
        {
            EditorSceneManager.OpenScene(ScenePath);
        }
    }

    private static void OnPlayModeStateChanged(PlayModeStateChange state)
    {
        if (state == PlayModeStateChange.EnteredPlayMode)
        {
            if (SessionState.GetBool(ValidationRequestedKey, false))
            {
                SessionState.SetBool(ValidationRequestedKey, false);
                SessionState.SetBool(ValidationRunningKey, true);
                phase = 1;
                phaseStartedAt = EditorApplication.timeSinceStartup;
                Debug.Log("--- Starting Physics And Keep Validation ---");
            }
        }
        else if (state == PlayModeStateChange.EnteredEditMode)
        {
            SessionState.SetBool(ValidationRequestedKey, false);
            SessionState.SetBool(ValidationRunningKey, false);
        }
    }

    private static void TryStartValidation()
    {
        if (!EditorApplication.isPlaying || !SessionState.GetBool(ValidationRunningKey, false))
        {
            return;
        }

        AugmentedYachtController controller = Object.FindFirstObjectByType<AugmentedYachtController>();
        if (controller == null) return;

        double elapsed = EditorApplication.timeSinceStartup - phaseStartedAt;

        switch (phase)
        {
            case 1: // 초기 굴림 시작
                if (elapsed > 0.5)
                {
                    controller.ResetAndRollDice();
                    phase = 2;
                    phaseStartedAt = EditorApplication.timeSinceStartup;
                }
                break;

            case 2: // 첫 굴림 완료 및 결과 검증
                if (controller.IsSettled)
                {
                    // 5개 주사위 눈이 1~6 범위 내에 있는지 확인
                    for (int i = 0; i < 5; i++)
                    {
                        int value = controller.GetDieValue(i);
                        if (value < 1 || value > 6)
                        {
                            Fail($"Die {i + 1} has invalid value: {value}");
                            return;
                        }
                    }

                    // 첫 두 개 주사위 킵(Keep)
                    controller.SetDieKept(0, true);
                    controller.SetDieKept(1, true);
                    firstKeptValue = controller.GetDieValue(0);
                    secondKeptValue = controller.GetDieValue(1);

                    phase = 3;
                    phaseStartedAt = EditorApplication.timeSinceStartup;
                }
                else if (elapsed > 5.0)
                {
                    Fail("Timed out waiting for first roll to settle.");
                }
                break;

            case 3: // 킵 적용 후 부분 재굴림(Re-roll) 시작
                if (elapsed > 0.5 && controller.IsSettled)
                {
                    if (controller.KeptDieCount != 2)
                    {
                        Fail($"Expected 2 kept dice, got {controller.KeptDieCount}");
                        return;
                    }

                    controller.RollDice();
                    phase = 4;
                    phaseStartedAt = EditorApplication.timeSinceStartup;
                }
                break;

            case 4: // 재굴림 완료 및 킵 보존 검증
                if (controller.IsSettled)
                {
                    int currentFirst = controller.GetDieValue(0);
                    int currentSecond = controller.GetDieValue(1);

                    if (currentFirst != firstKeptValue || currentSecond != secondKeptValue)
                    {
                        Fail($"Kept dice values changed! First: {firstKeptValue}->{currentFirst}, Second: {secondKeptValue}->{currentSecond}");
                        return;
                    }

                    Pass("Dice Baked Preset & Keep Layout Validation PASSED successfully!");
                    phase = 5;
                }
                else if (elapsed > 5.0)
                {
                    Fail("Timed out waiting for second roll to settle.");
                }
                break;
        }
    }

    private static void Pass(string message)
    {
        Debug.Log($"<color=green>[VALIDATION SUCCESS]</color> {message}");
        SessionState.SetBool(ValidationRunningKey, false);
        SessionState.SetBool(ValidationRequestedKey, false);
        EditorApplication.isPlaying = false;
    }

    private static void Fail(string reason)
    {
        Debug.LogError($"<color=red>[VALIDATION FAILED]</color> {reason}");
        SessionState.SetBool(ValidationRunningKey, false);
        SessionState.SetBool(ValidationRequestedKey, false);
        EditorApplication.isPlaying = false;
    }
}
