# Engine Decision

Status: Conditional Go

URP supports required low-resolution 3D render, Point upscale, hard-edged shadows, palette reduction, and real-time Rigidbody dice. Final decision still needs standalone 60-second profiling and side-by-side capture review on target hardware.

Known risk: physics-driven rotation can cause pixel crawl at 320x180. Compare 426x240 and, if needed, a stepped visual rotation experiment before production integration.
