# Tessera (Augmented Yacht Dice)

- Unity: 6000.3.21f1, URP 17.3.0
- Scene: `Assets/Scenes/Augmented Dice.unity`
- Source model: `Assets/Art/Reference/normal_dice.fbx`
- Playmat: `Assets/Art/Reference/playmat.png`
- Visual reference: `Assets/Art/Reference/dice_pixel_reference.png`
- Target: Windows desktop, 1920x1080, 60 FPS provisional

## Controls

- `ROLL 5 DICE` or Space: throw five dice from screen-bottom toward playmat center
- `960 / 640`, F1, F2: switch internal resolution
- `QUANTIZE`, Q: toggle 6-step RGB quantization

The fixed 16:9 world camera renders the whole composition into a 1920x1080 `RenderTexture`. The full-screen presentation shader snaps samples to a selectable 960x540 or 640x360 virtual pixel grid, preserving the low-resolution look without reducing the usable screen area or adding integer-scale letterboxing.

At 1920x1080, the default virtual 640x360 grid produces exact 3x3 screen-pixel blocks. The burgundy 3D mat extends beyond the camera footprint so no separate background is exposed. The tabletop is divided left/center/right at 25%/45%/30%: blank game-info paper, dice tray, and blank score-sheet paper. Dice follow staggered upward arcs over the tray's south rim; invisible tray safety colliders contain rebounds.

Dice launching ports the `augmented-dice` ingress pattern into Unity. The supplied `yacht-tray.stl` is converted to a two-material Unity mesh (dark rim and burgundy felt) at 0.05 scale, while one thick inner floor and non-overlapping box walls provide predictable tray collision without a concave MeshCollider. During launch, a real runway and the long side/back boundaries are active; the inner front wall is restored only after every current collider bound is fully inside it.

All five dice are planned in a circumsphere-safe 3+2 runway formation and sent toward separated first-impact points across the usable tray depth. Each die has its single solid `BoxCollider` enabled from creation. After an overlap-free offscreen preflight, deterministic 35 ms lane staggering and a 140 ms second wave make each Rigidbody dynamic with gravity, velocity, and spin; from that instant onward no code writes its position or rotation. There is no disabled-collider entrance, kinematic ballistic animation, lane teleport, or in-tray recovery grid. Gravity, collision response, friction, restitution, and damping at 120 Hz determine the complete visible trajectory.

Imported dice axes are aligned first and the visual is normalized once to the explicit 0.9-unit physics proxy. The Rigidbody root remains scale `(1,1,1)` from spawn through result and keep; dice are never enlarged or sorted after landing. Initial horizontal speeds are approximately 6.8–9.5 units/second with 0.71–0.94 second solved arcs that clear the visible rim. Playback stays at real `Time.timeScale = 1`; the fixed step is 1/120 second. High-speed flight uses `ContinuousDynamic` CCD and changes to discrete only after combined linear/angular swept distance is below 4% of an edge. Separate floor, wall, and dice materials keep the felt resistive and the walls low-friction. Floor, wall, and die-to-die contacts are tracked independently so a sustained low-speed jam can receive a small bounded, contact-normal release impulse; each touching die receives an equal-and-opposite impulse along its own contact normal. A persistent cocked rest or eight-second timeout rejects the result without moving, freezing, scaling, or automatically replacing any visible die. Settled dice remain sleeping dynamic bodies at their physical poses; clicking keep only locks that pose kinematically while retaining a solid collider.

`Tools > Tessera > Run Physics And Keep Validation` runs the deterministic Play Mode regression. It verifies real-time 120 Hz simulation, the fixed 0.9-unit solid `BoxCollider`, root-scale invariance, real runway activation velocity, motion continuity, peak/final penetration, die-to-die callbacks, controller-driven wall-jam motion, zero entry relocation/restart in the nominal seed, unchanged floor-rest result poses, pose-preserving keep, and partial re-roll behavior.

The `Full Field World Camera` is intentionally fixed: Play Mode never recenters or zooms it from Renderer bounds. Move and scale the papers, tray, and other visible world objects directly inside its 16:9 frame. Camera framing and the burgundy mat remain stable while the virtual pixel preset changes only the pixel-grid density.

## Editing the layout

The tabletop, papers, tray, rails, cameras, and presentation Canvas are serialized under `Tessera Game Root/Graphics Layout` and `Tessera Game Root/Pixel Presentation` in the `Augmented Dice` scene. Move or scale them directly in Edit Mode; Play Mode reuses these objects and does not rebuild them. If an older scene has no editable hierarchy yet, use `Tools > Tessera > Bake Editable Layout Into Scene` once. `Rebuild Augmented Dice Scene` is an explicit reset and discards manual layout changes.
